const MODULE_ID = 'niks-zoom-pan-options'

let isConflictingWithLockView = false
let _savedOnMouseDown = null

function getSetting(settingName) {
  return game.settings.get(MODULE_ID, settingName)
}

function localizeSetting(scope, str) {
  return game.i18n.localize(MODULE_ID + '.settings.' + scope + '.' + str)
}

function localizeKeybinding(scope, str) {
  return game.i18n.localize(MODULE_ID + '.keybindings.' + scope + '.' + str)
}

const updateMinMaxZoomLimits = () => {
  const c = globalThis.canvas
  if (!c?.scene) return
  const maxZoomFactor = getSetting('max-zoom-override') ?? 3
  const minZoomFactor = getSetting('min-zoom-override-v2') ?? 1
  // code based on the fvtt getDimensions function, which defaults to particular min and max scale values;
  // in my code here I repeat the calculation but allow changing the factors
  const sceneDimensions = c.scene.getDimensions()
  const padding = sceneDimensions.size
  const paddedSceneWidth = sceneDimensions.width + (2 * padding)
  const paddedSceneHeight = sceneDimensions.height + (2 * padding)
  const { innerWidth, innerHeight } = window
  const grid = c.scene.grid
  const sizeX = grid?.sizeX ?? grid?.size ?? 100
  const sizeY = grid?.sizeY ?? grid?.size ?? 100
  const sourceGridSize = c.scene._source?.grid?.size ?? grid?.size ?? 100
  const factor = (9 / maxZoomFactor) * (sourceGridSize / (grid?.size ?? 100))
  let minZoom = Math.min(innerWidth / paddedSceneWidth, innerHeight / paddedSceneHeight, 1) * minZoomFactor
  let maxZoom = Math.max(Math.min(innerWidth / sizeX, innerHeight / sizeY) / factor, minZoom)
  const initialScale = Number.isNumeric(c.scene.initial?.scale) ? c.scene.initial.scale : null
  if (initialScale !== null) {
    minZoom = Math.min(minZoom, initialScale)
    maxZoom = Math.max(maxZoom, initialScale)
  }
  CONFIG.Canvas.minZoom = minZoom
  CONFIG.Canvas.maxZoom = maxZoom
  // In V14, canvas.dimensions is frozen/readonly, so we wrap in try-catch
  // In V13, we still need to set these directly for the limits to take effect
  try {
    if (c.dimensions?.scale) {
      c.dimensions.scale.min = minZoom
      c.dimensions.scale.max = maxZoom
    }
  } catch (e) {
    // V14: dimensions are frozen, CONFIG.Canvas.minZoom/maxZoom is sufficient
  }
}

class MouseManager_ZoomPanOptions_Override {
  constructor() {
    if (game.mouse) throw new Error('You may not re-construct the singleton MouseManager instance.')
  }

  /**
   * The timestamp of the last mousewheel event.
   * @type {number}
   */
  #wheelTime = 0

  /**
   * Specify a rate limit for mouse wheel to gate repeated scrolling.
   * This is especially important for continuous scrolling mice which emit hundreds of events per second.
   * This designates a minimum number of milliseconds which must pass before another wheel event is handled
   * @type {number}
   */
  static MOUSE_WHEEL_RATE_LIMIT = 50

  /* -------------------------------------------- */

  /** ZPO:  utility function */
  debounceRotationByRateLimit() {
    const t = Date.now()
    if ((t - this.#wheelTime) < MouseManager_ZoomPanOptions_Override.MOUSE_WHEEL_RATE_LIMIT)
      return false
    this.#wheelTime = t
    return true
  }

  #placementRotationAccumulator = 0
  #lastPlacementRotationTime = 0

  /**
   * Rotate active placement preview (template or token) with touchpad sensitivity dampening.
   * Accumulates trackpad scroll delta before triggering a rotation step.
   * @param {CanvasLayer} layer
   * @param {WheelEvent} event
   * @param {boolean} precise
   * @returns {boolean}
   */
  _rotatePlacedTarget(layer, event, precise = true) {
    const now = Date.now()
    if ((now - this.#lastPlacementRotationTime) > 250) {
      this.#placementRotationAccumulator = 0
    }
    this.#lastPlacementRotationTime = now

    const delta = event.delta ?? (event.deltaY === 0 ? event.deltaX : event.deltaY)
    this.#placementRotationAccumulator += delta

    const TOUCHPAD_ROTATION_THRESHOLD = 40
    if (Math.abs(this.#placementRotationAccumulator) >= TOUCHPAD_ROTATION_THRESHOLD) {
      const steps = Math.trunc(this.#placementRotationAccumulator / TOUCHPAD_ROTATION_THRESHOLD)
      this.#placementRotationAccumulator -= steps * TOUCHPAD_ROTATION_THRESHOLD
      const maxSteps = Math.min(Math.abs(steps), 2)
      const sign = Math.sign(steps)
      for (let i = 0; i < maxSteps; i++) {
        layer._onMouseWheel({
          delta: sign,
          shiftKey: !precise,
        })
      }
    }
    return true
  }

  /**
   * Begin listening to mouse events.
   * @internal
   */
  _activateListeners() {
    window.addEventListener('wheel', this.#onWheel.bind(this), { passive: false })
  }

  /* -------------------------------------------- */

  /**
   * Master mouse-wheel event handler
   * @param {WheelEvent} event    The mouse wheel event
   */
  #onWheel(event) {
    // Prevent zooming the entire browser window
    // ZPO:  ctrl and meta should work the same way
    if (event.ctrlKey || event.metaKey) event.preventDefault()
    // ZPO:  (re-)defining some variables
    const MODIFIERS = foundry.helpers?.interaction?.KeyboardManager?.MODIFIER_KEYS ?? KeyboardManager?.MODIFIER_KEYS ?? {
      CONTROL: 'Control',
      SHIFT: 'Shift',
      ALT: 'Alt',
    }
    const isCtrl = game.keyboard.isModifierActive(MODIFIERS.CONTROL) // We cannot trust event.ctrlKey because of touchpads
    const isShift = event.shiftKey || game.keyboard.isModifierActive(MODIFIERS.SHIFT)
    const isAlt = event.altKey || game.keyboard.isModifierActive(MODIFIERS.ALT)

    // ZPO:  commenting this out and rewriting it in a way that allows for horizontal-only scroll (via trackpad for example)
    //// Interpret shift+scroll as vertical scroll
    //let dy = event.delta = event.deltaY
    //if (event.shiftKey && (dy === 0)) {
    //  dy = event.delta = event.deltaX
    //}
    //if (dy === 0) return
    const deltaY = event.deltaY
    const deltaX = event.deltaX
    // Foundry internally invents a field, `event.delta`, so we must define it (same way)
    event.delta = deltaY === 0 ? deltaX : deltaY

    // Take no actions if the canvas is not hovered
    const c = globalThis.canvas
    if (!c?.ready) return
    const hover = document.elementFromPoint(event.clientX, event.clientY)
    if (!hover || (hover.id !== 'board')) return
    event.preventDefault()

    // Select scrolling mode
    const mode = getSetting('pan-zoom-mode')

    // Case 1 - active ruler
    const ruler = c.controls?.ruler
    if (ruler?.active && (isCtrl || isShift)) return ruler._onMouseWheel(event)

    // Resolve any active placement layer (Foundry V14 Region templates or Tokens)
    const placementLayer = c.regions?._placementContext ? c.regions : (c.tokens?._placementContext ? c.tokens : null)

    // Case 2 - active layer / placement rotation in Mouse mode
    if (mode === 'Mouse') {
      if (isCtrl || isShift) {
        if (placementLayer) return placementLayer._onMouseWheel(event)
        return c.activeLayer?._onMouseWheel(event)
      }
    }

    // Case 2.1 - active placement rotation (regions/templates or tokens) in Touchpad mode
    if (mode === 'Touchpad' && isShift && placementLayer) {
      return checkZoomLock() && this._rotatePlacedTarget(placementLayer, event, isShift && !isCtrl)
    }

    // Case 2.2 - active layer handling (e.g. placeable rotation) for non-standard pan/zoom mode
    const layer = c.activeLayer
    const layerPossiblyHasRotatableObjects = layer?.options?.rotatableObjects
    const currentlyHasRotationTarget = layer?.options?.controllableObjects ? layer?.controlled?.length : !!layer?.hover
    if (layerPossiblyHasRotatableObjects && currentlyHasRotationTarget) {
      if (mode === 'Mouse' && (isCtrl || isShift)) {
        // this should never happen, since it's caught earlier in Case 2. kept here for completion
        return this.debounceRotationByRateLimit() && checkZoomLock() && layer._onMouseWheel(event)
      }
      if (mode === 'Touchpad' && isShift) {
        return this.debounceRotationByRateLimit() && checkZoomLock() && layer._onMouseWheel({
          delta: event.delta,
          shiftKey: isShift && !isCtrl,
        })
      }
      if (mode === 'Alternative' && isAlt && (isCtrl || isShift)) {
        return this.debounceRotationByRateLimit() && checkZoomLock() && layer._onMouseWheel({
          delta: event.delta,
          shiftKey: isShift,
        })
      }
    }

    // Case 2.3 - active placement rotation in Alternative mode
    if (mode === 'Alternative' && isAlt && (isCtrl || isShift) && placementLayer) {
      return this.debounceRotationByRateLimit() && checkZoomLock() && placementLayer._onMouseWheel({
        delta: event.delta,
        shiftKey: isShift,
      })
    }

    // ZPO:  detailed override/rewrite for zooming and panning

    // Case 3 - zoom or handle horizontal scroll in Mouse mode
    if (mode === 'Mouse') {
      const isHorizontal = deltaY === 0 && deltaX !== 0
      if (isHorizontal) {
        const action = getSetting('mouse-horizontal-scroll') ?? 'ignore'
        if (action === 'pan') {
          return panWithMultiplier(event)
        }
        if (action === 'zoom') {
          return zoom(event)
        }
        // Default: 'ignore' - do nothing
        return
      }
      return zoom(event)
    }

    // Case 3.1 - zoom the canvas if holding Ctrl (Touchpad or Alternative mode)
    if (
      (mode === 'Touchpad' && isCtrl)
      || (mode === 'Alternative' && isCtrl)
    ) {
      return zoom(event)
    }
    // Case 3.2 - zoom the canvas if the user is doing a pinch gesture (which sends a wheel event with ctrlKey=true)
    if ((mode === 'Touchpad' || mode === 'Alternative') && event.ctrlKey) {
      return zoom(event)
    }

    // Case 4 - pan the canvas horizontally (shift+scroll)
    if (mode === 'Alternative' && isShift) {
      // noinspection JSSuspiciousNameCombination
      return panWithMultiplier({
        deltaX: deltaY, // (this is intentionally passing Y for X)
        deltaY: 0,
      })
    }

    // Case 5 - pan the canvas in the direction of the mouse/touchpad event
    panWithMultiplier(event)
  }
}

/**
 * Will zoom based on delta.
 */
function zoom(event) {
  if (!checkZoomLock()) return
  const delta = event?.delta ?? (event?.deltaY === 0 ? event?.deltaX : event?.deltaY)
  if (!delta) return

  const multiplier = getSetting('zoom-speed-multiplier')

  // scaleChangeRatio was originally called "dz" but that's not really descriptive.  it's usually 1.05 or 0.95.
  // default foundry behavior is 1.05 and 0.95, but I actually change it to 1.05 and 0.95238 (*105% and /105%).
  // I do this because it makes one zoom-in tick plus one zoom-out tick cancel each other; their product is 1.
  const fivePercentZoom = delta < 0 ? 1.05 : (1 / 1.05)
  const speedBasedZoom = 1.05 ** (-delta * 0.01 * multiplier)
  const scaleChangeRatio = multiplier === 0 ? fivePercentZoom : speedBasedZoom

  const c = globalThis.canvas
  if (!c?.stage?.scale || !c?.stage?.pivot) return
  const scale = c.stage.scale.x // scale x and scale y are the same
  const targetScale = scaleChangeRatio * scale
  // Prefer canvas.dimensions values (set on V13), fall back to CONFIG.Canvas (set on both V13/V14)
  const max = c.dimensions?.scale?.max ?? CONFIG.Canvas.maxZoom
  const min = c.dimensions?.scale?.min ?? CONFIG.Canvas.minZoom
  if (targetScale > max || targetScale < min) {
    if (scale === max || scale === min) {
      console.debug("Nik's Zoom / Pan Options |", `scale is at limit (${scale})`)
      return
    }
    console.debug("Nik's Zoom / Pan Options |", `scale (${targetScale}) would exceed limit, bounding to interval [${min}, ${max}].`)
    c.pan({ x: c.stage.pivot.x, y: c.stage.pivot.y, scale: Math.clamp(targetScale, min, max) })
    return
  }
  /** note:  minZoom and maxZoom will be applied to canvas.dimensions.scale.max (etc) and then used in _constrainView */
  c.pan({ x: c.stage.pivot.x, y: c.stage.pivot.y, scale: targetScale })
}

function panWithMultiplier(event) {
  if (!checkPanLock()) return
  const c = globalThis.canvas
  if (!c?.stage?.scale || !c?.stage?.pivot) return
  const multiplier = (1 / c.stage.scale.x) * getSetting('pan-speed-multiplier')
  const invertVerticalScroll = getSetting('invert-vertical-scroll') ? -1 : 1
  const x = c.stage.pivot.x + event.deltaX * multiplier
  const y = c.stage.pivot.y + event.deltaY * multiplier * invertVerticalScroll
  c.pan({ x, y })
}

function disableMiddleMouseScrollIfMiddleMousePanIsActive(isActive) {
  if (isActive) {
    // this will prevent middle-click from showing the scroll icon
    _savedOnMouseDown = document.body.onmousedown
    document.body.onmousedown = function (e) { if (e.button === 1) return false }
  } else {
    document.body.onmousedown = _savedOnMouseDown
    _savedOnMouseDown = null
  }
}

const disableBrowserGesturesIfTouchpad = (panZoomMode) => {
  if (panZoomMode === 'Touchpad' || panZoomMode === 'Alternative') {
    // disable browser back/forward gestures
    document.body.style.overscrollBehaviorX = 'none'
  } else if (document.body.style.overscrollBehaviorX === 'none') {
    document.body.style.overscrollBehaviorX = ''
  }
}

const createMimDebug = (mim) => (action, event, outcome = mim.handlerOutcomes.ACCEPTED) => {
  if (CONFIG.debug.mouseInteraction) {
    const name = mim.object.constructor.name
    const targetName = event.target?.constructor.name
    const { eventPhase, type, button } = event
    const state = Object.keys(mim.states)[mim.state.toString()]
    let msg = `${name} | ${action} | state:${state} | target:${targetName} | phase:${eventPhase} | type:${type} | `
      + `btn:${button} | skipped:${outcome <= -2} | allowed:${outcome > -1} | handled:${outcome > 1}`
    console.debug(msg)
  }
}

const handleMouseDown_forMiddleClickDrag = (mouseDownEvent) => {
  if (!getSetting('middle-mouse-pan')) return true
  const button = mouseDownEvent?.button ?? mouseDownEvent?.nativeEvent?.button ?? mouseDownEvent?.data?.originalEvent?.button
  if (button !== 1) return true // buttons other than middle click - ignoring
  const c = globalThis.canvas
  const mim = c?.mouseInteractionManager
  if (!mim) return true

  /*
   * --- This section is awkward ---
   *
   * I'm copying a lot of code from MouseInteractionManager functions, and:
   * - replacing `this` with `mim`
   * - replacing `this.#function` with `mim_function`
   * - commenting out code that is not necessary for the "pretend middle-click-drag is right-click-drag" thing
   */

  const mim_handleRightDown = (event) => {
    if (!mim.state.between(mim.states.HOVER, mim.states.DRAG)) return

    //// Determine double vs single click
    //const isDouble = ((event.timeStamp - mim.rcTime) <= MouseInteractionManager.DOUBLE_CLICK_TIME_MS)
    //  && (Math.hypot(event.clientX - mim.lastClick.x, event.clientY - mim.lastClick.y)
    //    <= MouseInteractionManager.DOUBLE_CLICK_DISTANCE_PX);
    //mim.rcTime = isDouble ? 0 : event.timeStamp;
    mim.rcTime = event.timeStamp
    mim.lastClick.set(event.clientX, event.clientY)

    // Assign origin data
    mim_assignOriginData(event)

    // Update event data
    mim.interactionData.origin = event.getLocalPosition(mim.layer)

    //// Dispatch to double and single-click handlers
    //if ( isDouble && mim.can("clickRight2", event) ) return mim_handleClickRight2(event);
    //else return mim_handleClickRight(event);
    return mim_handleClickRight(event)
  }

  const mim_handleClickRight = (event) => {
    const action = 'clickRight'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    mim._dragRight = true

    //// Was the right-click event handled by the callback?
    //const priorState = mim.state;
    if (mim.state === mim.states.HOVER) mim.state = mim.states.CLICKED
    if (c) c.currentMouseManager = mim
    //if ( mim.callback(action, event) === false ) {
    //  mim.state = priorState;
    //  canvas.currentMouseManager = null;
    //  return mim_debug(action, event, mim.handlerOutcomes.REFUSED);
    //}

    // Activate drag event handlers
    if ((mim.state === mim.states.CLICKED) && mim.can('dragRight', event)) {
      mim.state = mim.states.GRABBED
      mim_activateDragEvents()
    }
    //return mim_debug(action, event);
  }

  const mim_activateDragEvents = () => {
    mim_deactivateDragEvents()
    mim.layer.on('pointermove', mim_handlers_pointermove)
    //if ( !mim._dragRight ) {
    //  canvas.app.view.addEventListener("contextmenu", mim.#handlers.contextmenu, {capture: true});
    //}
  }

  const mim_deactivateDragEvents = () => {
    mim.layer.off('pointermove', mim_handlers_pointermove)
    //canvas.app.view.removeEventListener("contextmenu", mim.#handlers.contextmenu, {capture: true});
  }

  /**
   * based on #handlePointerMove code
   */
  const mim_handlers_pointermove = (event) => {
    if (!mim.state.between(mim.states.GRABBED, mim.states.DRAG)) return

    // Limit dragging to 60 updates per second
    const now = Date.now()
    if (c?.app?.ticker && (now - mim.dragTime) < c.app.ticker.elapsedMS) return
    mim.dragTime = now

    // Update interaction data
    const data = mim.interactionData
    data.destination = event.getLocalPosition(mim.layer, data.destination)

    // Begin a new drag event
    if (mim.state !== mim.states.DRAG) {
      const dx = event.global.x - data.screenOrigin.x
      const dy = event.global.y - data.screenOrigin.y
      const dz = Math.hypot(dx, dy)
      const r = mim.options.dragResistance ||
        foundry.canvas.interaction.MouseInteractionManager.DEFAULT_DRAG_RESISTANCE_PX
      if (dz >= r) mim_handleDragStart(event)
    }

    // Continue a drag event
    if (mim.state === mim.states.DRAG) mim_handleDragMove(event)
  }

  const mim_handleDragStart = (event) => {
    clearTimeout(mim.constructor.longPressTimeout)
    const action = mim._dragRight ? 'dragRightStart' : 'dragLeftStart'
    if (!mim.can(action, event)) {
      mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
      mim.cancel(event)
      return
    }
    mim.state = mim.states.DRAG
    if (mim.callback(action, event) === false) {
      mim.state = mim.states.GRABBED
      return mim_debug(action, event, mim.handlerOutcomes.REFUSED)
    }
    return mim_debug(action, event, mim.handlerOutcomes.ACCEPTED)
  }

  const mim_handleDragMove = (event) => {
    clearTimeout(mim.constructor.longPressTimeout)
    const action = mim._dragRight ? 'dragRightMove' : 'dragLeftMove'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    const handled = mim.callback(action, event)
    return mim_debug(action, event, handled ? mim.handlerOutcomes.ACCEPTED : mim.handlerOutcomes.REFUSED)
  }

  const mim_assignOriginData = (event) => {
    // Set the origin point from layer local position
    mim.interactionData.origin = event.getLocalPosition(mim.layer)

    // Set screenOrigin as the screen coordinates of the origin
    mim.interactionData.screenOrigin = new PIXI.Point(event.global.x, event.global.y)
  }

  const mim_debug = createMimDebug(mim)

  mim_handleRightDown(mouseDownEvent)
  // `return false` will call stopPropagation and preventDefault
  return false
}

const handleMouseUp_forMiddleClickDrag = (mouseUpEvent) => {
  if (!getSetting('middle-mouse-pan')) return true
  const button = mouseUpEvent?.button ?? mouseUpEvent?.nativeEvent?.button ?? mouseUpEvent?.data?.originalEvent?.button
  if (button !== 1) return true // buttons other than middle click - ignoring
  const c = globalThis.canvas
  const mim = c?.mouseInteractionManager
  if (!mim) return true
  // Copying (and mildly altering) code from MouseInteractionManager functions. mostly replacing references

  const mim_handlePointerUp = (event) => {
    //clearTimeout(mim.constructor.longPressTimeout);
    //// If this is a touch hover event, treat it as a drag
    //if ( (mim.state === mim.states.HOVER) && (event.pointerType === "touch") ) {
    //  mim.state = mim.states.DRAG;
    //}

    // Save prior state
    const priorState = mim.state

    // Update event data
    mim.interactionData.destination = event.getLocalPosition(mim.layer, mim.interactionData.destination)

    if (mim.state >= mim.states.DRAG) {
      event.stopPropagation()
      if (event.type.startsWith('right') && !mim._dragRight) return
      if (mim.state === mim.states.DRAG) mim_handleDragDrop(event)
    }

    // Continue a multi-click drag workflow
    if (event.defaultPrevented) {
      mim.state = priorState
      return mim_debug('mouseUp', event, mim.handlerOutcomes.SKIPPED)
    }

    // Handle the unclick event
    mim_handleUnclick(event)

    // Cancel the workflow
    return mim_handleDragCancel(event)
  }

  const mim_handleDragDrop = (event) => {
    const action = 'dragRightDrop'
    if (!mim.can(action, event)) return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)

    // Was the drag-drop event handled by the callback?
    mim.state = mim.states.DROP
    if (mim.callback(action, event) === false) {
      mim.state = mim.states.DRAG
      return mim_debug(action, event, mim.handlerOutcomes.DISALLOWED)
    }

    // Update the workflow state
    return mim_debug(action, event)
  }

  const mim_handleDragCancel = (event) => {
    mim.cancel(event)
  }

  const mim_handleUnclick = (event) => {
    // I'm just simplifying the code here
    event.stopPropagation()
  }

  const mim_debug = createMimDebug(mim)

  mim_handlePointerUp(mouseUpEvent)
  // `return false` will call stopPropagation and preventDefault
  return false
}

const checkZoomLock = () => {
  // LockView compatibility workaround
  if (isConflictingWithLockView) {
    const lockZoom = globalThis.canvas?.scene?.getFlag('LockView', 'lockZoom')
    if (lockZoom) {
      return false
    }
  }
  return true
}

const checkPanLock = () => {
  if (isConflictingWithLockView) {
    const lockPan = globalThis.canvas?.scene?.getFlag('LockView', 'lockPan')
    if (lockPan) {
      return false
    }
  }
  return true
}

function _onDragCanvasPan_override(event) {
  if (!checkPanLock()) {
    return
  }

  // Throttle panning by 200ms
  const now = Date.now()
  if (now - (this._panTime || 0) <= 200) return
  this._panTime = now

  // Shift by a few grid spaces at a time
  const { x, y } = event
  const pad = 50
  const shift = (this.dimensions.size * 3) / this.stage.scale.x

  // Shift horizontally
  let dx = 0
  if (x < pad) dx = -shift
  else if (x > window.innerWidth - pad) dx = shift

  // Shift vertically
  let dy = 0
  if (y < pad) dy = -shift
  else if (y > window.innerHeight - pad) dy = shift

  // Enact panning
  if (dx || dy) return this.animatePan({ x: this.stage.pivot.x + dx, y: this.stage.pivot.y + dy, duration: 200 })
}

const avoidLockViewIncompatibility = () => {
  Hooks.on('libWrapper.ConflictDetected', (p1, p2, target, frozenNames) => {
    if ((p1 === MODULE_ID && p2 === 'LockView') || (p2 === MODULE_ID && p1 === 'LockView')) {
      if (frozenNames.includes('foundry.canvas.Canvas.prototype._onDragCanvasPan')) {
        if (!game.user.isGM) {
          if (!getSetting('disable-lock-view-compatibility-fix')) {
            isConflictingWithLockView = true
          }
        }
      }
    }
  })
  game.settings.register(MODULE_ID, 'disable-lock-view-compatibility-fix', {
    name: 'hidden setting in case I fuck up my attempt to fix that bug',
    scope: 'client',
    config: false,
    default: false,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'first-time-setup-done', {
    scope: 'client',
    config: false,
    default: false,
    type: Boolean,
  })
}

Hooks.on('init', function () {
  console.log("Initializing Nik's Zoom / Pan Options")
  game.settings.register(MODULE_ID, 'pan-zoom-mode', {
    name: localizeSetting('pan-zoom-mode', 'name'),
    hint: localizeSetting('pan-zoom-mode', 'hint'),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'Mouse': localizeSetting('pan-zoom-mode', 'choice_mouse'),
      'Touchpad': localizeSetting('pan-zoom-mode', 'choice_touchpad'),
      'Alternative': localizeSetting('pan-zoom-mode', 'choice_alternative'),
    },
    onChange: disableBrowserGesturesIfTouchpad,
    default: 'Mouse',
  })
  game.settings.register(MODULE_ID, 'mouse-horizontal-scroll', {
    name: localizeSetting('mouse-horizontal-scroll', 'name'),
    hint: localizeSetting('mouse-horizontal-scroll', 'hint'),
    scope: 'client',
    config: true,
    type: String,
    choices: {
      'ignore': localizeSetting('mouse-horizontal-scroll', 'choice_ignore'),
      'pan': localizeSetting('mouse-horizontal-scroll', 'choice_pan'),
      'zoom': localizeSetting('mouse-horizontal-scroll', 'choice_zoom'),
    },
    default: 'ignore',
  })
  game.settings.register(MODULE_ID, 'middle-mouse-pan', {
    name: localizeSetting('middle-mouse-pan', 'name'),
    hint: localizeSetting('middle-mouse-pan', 'hint'),
    scope: 'client',
    config: true,
    default: true,
    type: Boolean,
    onChange: disableMiddleMouseScrollIfMiddleMousePanIsActive,
  })
  game.settings.register(MODULE_ID, 'max-zoom-override', {
    name: localizeSetting('max-zoom-override', 'name'),
    hint: localizeSetting('max-zoom-override', 'hint'),
    scope: 'client',
    config: true,
    default: 3,
    type: Number,
    onChange: updateMinMaxZoomLimits,
  })
  // migrating away from this...
  game.settings.register(MODULE_ID, 'min-zoom-override', {
    name: localizeSetting('min-zoom-override', 'name'),
    hint: localizeSetting('min-zoom-override', 'hint'),
    scope: 'client',
    config: false,
    default: 1 / 3,
    type: Number,
    onChange: updateMinMaxZoomLimits,
  })
  // ...to this:
  game.settings.register(MODULE_ID, 'min-zoom-override-v2', {
    name: localizeSetting('min-zoom-override', 'name'),
    hint: localizeSetting('min-zoom-override', 'hint'),
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
    onChange: updateMinMaxZoomLimits,
  })
  if (game.settings.get(MODULE_ID, 'min-zoom-override') !== null) {
    console.log("Nik's Zoom / Pan Options |", 'migrating min-zoom-override to min-zoom-override-v2')
    console.log("Nik's Zoom / Pan Options |",
      `old setting value was: ${game.settings.get(MODULE_ID, 'min-zoom-override')}`)
    game.settings.set(MODULE_ID, 'min-zoom-override-v2', game.settings.get(MODULE_ID, 'min-zoom-override') * 3)
    game.settings.set(MODULE_ID, 'min-zoom-override', null)
  }

  game.settings.register(MODULE_ID, 'invert-vertical-scroll', {
    name: localizeSetting('invert-vertical-scroll', 'name'),
    hint: localizeSetting('invert-vertical-scroll', 'hint'),
    scope: 'client',
    config: true,
    default: false,
    type: Boolean,
  })
  game.settings.register(MODULE_ID, 'zoom-speed-multiplier', {
    name: localizeSetting('zoom-speed-multiplier', 'name'),
    hint: localizeSetting('zoom-speed-multiplier', 'hint'),
    scope: 'client',
    config: true,
    default: 0,
    type: Number,
  })
  game.settings.register(MODULE_ID, 'pan-speed-multiplier', {
    name: localizeSetting('pan-speed-multiplier', 'name'),
    hint: localizeSetting('pan-speed-multiplier', 'hint'),
    scope: 'client',
    config: true,
    default: 1,
    type: Number,
  })

  game.settings.register(MODULE_ID, 'touchpad-defaults-updated', {
    scope: 'client',
    config: false,
    default: false,
    type: Boolean,
  })

  if (!game.settings.get(MODULE_ID, 'touchpad-defaults-updated')) {
    const currentMode = game.settings.get(MODULE_ID, 'pan-zoom-mode')
    const currentZoom = game.settings.get(MODULE_ID, 'zoom-speed-multiplier')
    const currentPan = game.settings.get(MODULE_ID, 'pan-speed-multiplier')

    if (currentMode === 'Touchpad' && (currentZoom !== 10 || currentPan !== 1)) {
      game.settings.set(MODULE_ID, 'zoom-speed-multiplier', 10)
      game.settings.set(MODULE_ID, 'pan-speed-multiplier', 1)
    }
    game.settings.set(MODULE_ID, 'touchpad-defaults-updated', true)
  }

  // Register Keybindings

  game.keybindings.register(MODULE_ID, 'toggleTouchpadMode', {
    name: localizeKeybinding('toggle-touchpad-mode', 'name'),
    editable: [],
    onDown: () => {
      // will toggle between Mouse and Touchpad
      const mode = ['Mouse', 'Alternative'].includes(game.settings.get(MODULE_ID, 'pan-zoom-mode'))
        ? 'Touchpad'
        : 'Mouse'
      game.settings.set(MODULE_ID, 'pan-zoom-mode', mode)
      ui.notifications.info(localizeKeybinding('notifications', mode))
    },
    repeat: false,
  })

  game.keybindings.register(MODULE_ID, 'toggleAlternativeMode', {
    name: localizeKeybinding('toggle-alternative-mode', 'name'),
    editable: [],
    onDown: () => {
      // will toggle between Mouse and Alternative
      const mode = ['Mouse', 'Touchpad'].includes(game.settings.get(MODULE_ID, 'pan-zoom-mode'))
        ? 'Alternative'
        : 'Mouse'
      game.settings.set(MODULE_ID, 'pan-zoom-mode', mode)
      ui.notifications.info(localizeKeybinding('notifications', mode))
    },
    repeat: false,
  })

  avoidLockViewIncompatibility()
})

Hooks.once('setup', function () {
  libWrapper.register(
    MODULE_ID,
    'foundry.canvas.Canvas.prototype._onMouseWheel',
    (event) => {
      // Delegate to custom zoom handler if called externally (e.g. from template hud or other tools)
      zoom(event)
    },
    'OVERRIDE',
  )
  libWrapper.register(
    MODULE_ID,
    'foundry.canvas.Canvas.prototype._onDragCanvasPan',
    _onDragCanvasPan_override,
    'OVERRIDE',
  )
  disableMiddleMouseScrollIfMiddleMousePanIsActive(getSetting('middle-mouse-pan'))
  disableBrowserGesturesIfTouchpad(getSetting('pan-zoom-mode'))

  // override game.mouse
  window.MouseManager_ZoomPanOptions_Override = MouseManager_ZoomPanOptions_Override
  Object.defineProperty(game, 'mouse', { value: null, writable: true })
  const newMouseManager = new window.MouseManager_ZoomPanOptions_Override()
  Object.defineProperty(game, 'mouse', { value: newMouseManager, writable: false })

  console.log("Done setting up Nik's Zoom / Pan Options.")
})

Hooks.on('canvasReady', (canvas) => {
  const c = canvas ?? globalThis.canvas
  c?.stage?.off('mousedown', handleMouseDown_forMiddleClickDrag)
  c?.stage?.off('mouseup', handleMouseUp_forMiddleClickDrag)
  c?.stage?.on('mousedown', handleMouseDown_forMiddleClickDrag)
  c?.stage?.on('mouseup', handleMouseUp_forMiddleClickDrag)
  updateMinMaxZoomLimits()
})

Hooks.on('canvasInit', () => {
  updateMinMaxZoomLimits()
})

window.addEventListener('resize', () => {
  if (globalThis.canvas?.ready) updateMinMaxZoomLimits()
}, { passive: true })

Hooks.once('ready', () => {
  if (!game.settings.get(MODULE_ID, 'first-time-setup-done')) {
    new Dialog({
      title: game.i18n.localize(`${MODULE_ID}.dialogs.setup.title`),
      content: game.i18n.localize(`${MODULE_ID}.dialogs.setup.content`),
      buttons: {
        mouse: {
          icon: '<i class="fas fa-mouse"></i>',
          label: game.i18n.localize(`${MODULE_ID}.dialogs.setup.button_mouse`),
          callback: () => {
            game.settings.set(MODULE_ID, 'first-time-setup-done', true)
          }
        },
        touchpad: {
          icon: '<i class="fas fa-hand-pointer"></i>',
          label: game.i18n.localize(`${MODULE_ID}.dialogs.setup.button_touchpad`),
          callback: () => {
            game.settings.set(MODULE_ID, 'pan-zoom-mode', 'Touchpad')
            game.settings.set(MODULE_ID, 'zoom-speed-multiplier', 10)
            game.settings.set(MODULE_ID, 'pan-speed-multiplier', 1)
            game.settings.set(MODULE_ID, 'first-time-setup-done', true)
          }
        }
      },
      default: "mouse"
    }).render(true)
  }
})
