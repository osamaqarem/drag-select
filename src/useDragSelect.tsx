import { Platform } from "react-native"
import { Gesture } from "react-native-gesture-handler"
import {
  interpolate,
  measure,
  runOnJS,
  runOnUI,
  scrollTo,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type MeasuredDimensions,
} from "react-native-reanimated"
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes"
import type { Config, DragSelect } from "./types"

export function useDragSelect<ListItem extends Record<string, any>>(
  config: Config<ListItem>
): DragSelect<ListItem> {
  const {
    data,
    key: keyPath,
    onItemPress,
    onItemSelected,
    onItemDeselected,
  } = config

  const {
    animatedRef,
    numColumns = 1,
    rowGap,
    columnGap,
    itemSize: { height: itemHeight, width: itemWidth },
    contentInset,
  } = config.list

  const {
    left: insetLeft = 0,
    right: insetRight = 0,
    top: insetTop = 0,
    bottom: insetBottom = 0,
  } = contentInset ?? {}

  const {
    enabled: longPressGestureEnabled = true,
    minDurationMs: longPressMinDurationMs = 300,
  } = config.longPressGesture ?? {}

  const {
    enabled: panScrollEnabled = true,
    endThreshold: panScrollEndThreshold = 0.85,
    startThreshold: panScrollStartThreshold = 0.15,
    endMaxVelocity: panScrollEndMaxVelocity = Platform.select({
      default: 8,
      android: 1,
    }),
    startMaxVelocity: panScrollStartMaxVelocity = Platform.select({
      default: 8,
      android: 1,
    }),
  } = config.panScrollGesture ?? {}

  function getId(item: ListItem) {
    "worklet"
    return getPropertyByPath(item, keyPath)
  }

  const itemMap = useDerivedValue(
    // note: `data` copied to UI thread.
    () => new Map(data.map((d) => [getId(d) as string, d]))
  )

  type ItemMap = Record<string, ListItem>
  const selectedItems = useSharedValue<ItemMap>({})
  const axisId = useSharedValue("")
  const selectModeActive = useDerivedValue(
    () => Object.keys(selectedItems.value).length > 0
  )

  const panTransitionFromIndex = useSharedValue<number | null>(null)
  const panEvent = useSharedValue<{
    y: number
    x: number
    translationX: number
    translationY: number
  } | null>(null)

  const listLayout = useSharedValue<MeasuredDimensions | null>(null)

  const scrollContentHeight = useSharedValue(0)
  const scrollOffset = useSharedValue(0)

  function measureListLayout() {
    "worklet"
    listLayout.value = measure(animatedRef)
    if (!listLayout.value && __DEV__) {
      throw new Error("Failed to measure layout: `measure` returned `null`")
    }
  }

  function select(id: string) {
    "worklet"
    const item = itemMap.value.get(id)
    if (!item) return
    const inSelection = selectedItems.value[id]
    if (inSelection) return
    selectedItems.modify((state) => {
      // @ts-expect-error `state` is generic
      state[id] = item
      return state
    })
    if (onItemSelected) runOnJS(onItemSelected)(item)
  }

  function deselect(id: string) {
    "worklet"
    const item = selectedItems.value[id]
    if (!item) return
    selectedItems.modify((state) => {
      delete state[id]
      return state
    })
    if (onItemDeselected) runOnJS(onItemDeselected)(item)
  }

  // TODO: refactor to rect/contains instead of points
  function handleDragSelect(e: NonNullable<typeof panEvent.value>) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !data) return
    if (!axisId.value && __DEV__) {
      throw new Error("handleDragSelect: axisId was not set.")
    }

    const inset = {
      top: insetTop,
      bottom: scrollContentHeight.value - scrollOffset.value - insetBottom,
      left: insetLeft,
      right: insetRight, // todo(horizontal lists): factor in scroll offset
    }

    const windowHeight = listLayout.value.height

    const cellHeight = itemHeight + rowGap
    const cellWidth = itemWidth + columnGap

    const numItemsYAxis = Math.ceil(windowHeight / cellHeight)
    const numItemsXAxis = numColumns

    const insetTopWithScroll = Math.max(0, inset.top - scrollOffset.value)
    const safePanY = e.y - insetTopWithScroll
    const safePanX = e.x // todo(horizontal lists): factor in scroll offset

    // noop when panning in top or bottom padding (outside list items)
    if (safePanY < 0 || e.y > listLayout.value.height) return

    // account for a row item being cut-off when scroll offset is not 0
    const scrolledPastTopInset = scrollOffset.value >= inset.top
    const breakpointYoffset = scrolledPastTopInset
      ? cellHeight - ((scrollOffset.value - inset.top) % cellHeight)
      : 0

    let breakpointsY = Array.from({ length: numItemsYAxis }).map((_, index) => {
      return (index + 1) * cellHeight + breakpointYoffset
    })
    if (breakpointYoffset > 0) {
      breakpointsY.unshift(breakpointYoffset)
    }
    breakpointsY.unshift(0)

    let breakpointsX = Array.from({ length: numItemsXAxis }).map((_, index) => {
      if (index === 0) {
        return (index + 1) * cellWidth + insetLeft
      }
      return (index + 1) * cellWidth + columnGap
    })
    breakpointsX.unshift(inset.left)

    const getBreakpointBoundsIndices = (
      value: number,
      breakpoints: Array<number>
    ): [number, number] => {
      let idx = 0
      for (const breakpoint of breakpoints) {
        if (value >= breakpoint) {
          idx += 1
        } else {
          return [idx - 1, idx]
        }
      }
      return [idx - 1, idx]
    }

    let [indexLowY, indexHighY] = getBreakpointBoundsIndices(
      safePanY,
      breakpointsY
    )
    let [indexLowX, indexHighX] = getBreakpointBoundsIndices(
      safePanX,
      breakpointsX
    )

    const lowY = breakpointsY[indexLowY]!
    const highY = breakpointsY[indexHighY]!
    const lowX = breakpointsX[indexLowX]!
    const highX = breakpointsX[indexHighX]!
    const withinX = safePanX >= lowX && safePanX <= highX
    const withinY = safePanY >= lowY && safePanY <= highY

    if (!withinY || !withinX) return

    const scrolledRows = scrolledPastTopInset
      ? Math.floor(Math.abs((inset.top - scrollOffset.value) / cellHeight))
      : 0
    const rowBeginsAtIndex = scrolledRows * numColumns

    const calculateIndex = (rowIndex: number, colIndex: number) => {
      const arraysStartAtZero = 1
      return (
        rowIndex * numColumns -
        (numColumns - colIndex) +
        rowBeginsAtIndex -
        arraysStartAtZero
      )
    }

    const itemIndex = calculateIndex(indexHighY, indexHighX)

    const itemAt = (index: number) => {
      // note: `data` copied to UI thread.
      const itemInState = data[index]
      if (!itemInState) return undefined
      const id = getId(itemInState)
      return itemMap.value.get(id)
    }

    if (panTransitionFromIndex.value === null) {
      panTransitionFromIndex.value = itemIndex
    }

    /**
     * axis cell: the cell where the long-press occured.
     * next cell: the cell being entered
     * previous cell: the cell being left
     *
     * Logic:
     * - when entering a cell
     *    - select all cells between the axis cell and the next cell
     *         - when the next cell row is before the axis row
     *              - deselect all cells after the axis
     *         - when the cell row is after the axis row
     *              - deselect all cells before the axis
     */
    const toIndex = itemIndex
    if (panTransitionFromIndex.value !== toIndex) {
      const selectItemAtIndex = (i: number) => {
        const curr = itemAt(i)
        if (curr) {
          const currId = getId(curr)
          select(currId)
        }
      }
      const deselectItemAtIndex = (i: number) => {
        const curr = itemAt(i)
        if (curr) {
          const currId = getId(curr)
          if (axisId.value === currId) return
          deselect(currId)
        }
      }

      const fromIndex = panTransitionFromIndex.value

      const axisItemId = axisId.value
      // note: `data` copied to UI thread.
      const axisIndex = data.findIndex((d) => getId(d) === axisItemId)
      const axisRow = Math.floor(axisIndex / numColumns) + 1
      const toRow = Math.floor(itemIndex / numColumns) + 1

      const isAxisRow = toRow === axisRow
      const afterAxisRow = toRow > axisRow
      const beforeAxisRow = toRow < axisRow

      const backwards = toIndex < fromIndex
      const forwards = toIndex > fromIndex

      if (backwards) {
        for (let i = fromIndex; i > toIndex; i--) {
          deselectItemAtIndex(i)
        }
      }
      if (afterAxisRow || (isAxisRow && forwards)) {
        for (let i = axisIndex; i <= toIndex; i++) {
          selectItemAtIndex(i)
        }
      } else if (beforeAxisRow || (isAxisRow && backwards)) {
        for (let i = axisIndex; i >= toIndex; i--) {
          selectItemAtIndex(i)
        }
      }
    }

    panTransitionFromIndex.value = toIndex
  }

  const { setActive: setFrameCbActive } = useFrameCallback(() => {
    if (!panEvent.value || !selectModeActive.value || !listLayout.value) {
      return
    }

    handleDragSelect(panEvent.value)

    if (!panScrollEnabled) return
    const windowHeight = listLayout.value.height
    const endEdgeThreshold = windowHeight * panScrollEndThreshold
    const startEdgeThreshold = windowHeight * panScrollStartThreshold

    const { y } = panEvent.value
    if (y > endEdgeThreshold) {
      const inputRange = [endEdgeThreshold, windowHeight]
      const outputRange = [0, panScrollEndMaxVelocity]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value + result
      scrollTo(animatedRef, 0, offset, false)
    } else if (scrollOffset.value > 0 && y < startEdgeThreshold) {
      const inputRange = [startEdgeThreshold, 0]
      const outputRange = [0, panScrollStartMaxVelocity]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value - result
      scrollTo(animatedRef, 0, offset, false)
    }
  }, false)

  function longPressOnStart(id: string) {
    "worklet"
    const longPressed = itemMap.value.get(id)
    if (!longPressed) return
    const inSelection = selectedItems.value[id]
    if (inSelection) return
    axisId.value = id
    select(id)
  }

  function tapOnStart(id: string) {
    "worklet"
    const tapped = itemMap.value.get(id)
    if (!tapped) return

    if (selectModeActive.value) {
      const inSelection = selectedItems.value[id]
      if (inSelection) {
        deselect(id)
      } else {
        select(id)
      }
    } else if (onItemPress) {
      runOnJS(onItemPress)(tapped)
    }
  }

  const panHandler = Gesture.Pan()
    .maxPointers(1)
    .activateAfterLongPress(selectModeActive.value ? 0 : longPressMinDurationMs)
    .onStart(() => {
      measureListLayout()
      runOnJS(setFrameCbActive)(true)
    })
    .onUpdate((e) => {
      panEvent.value = {
        y: e.y,
        x: e.x,
        translationX: e.translationX,
        translationY: e.translationY,
      }
    })
    .onEnd(() => {
      panTransitionFromIndex.value = null
      panEvent.value = null
      runOnJS(setFrameCbActive)(false)
    })

  function createItemPressHandler(item: ListItem) {
    const tapGesture = Gesture.Tap()
      .maxDuration(longPressMinDurationMs)
      .onStart(() => tapOnStart(getId(item)))

    const longPressGesture = Gesture.LongPress()
      .minDuration(longPressMinDurationMs)
      .onStart(() => longPressOnStart(getId(item)))
      .simultaneousWithExternalGesture(panHandler)
      .enabled(longPressGestureEnabled)

    return Gesture.Simultaneous(tapGesture, longPressGesture)
  }

  function onScroll(event: ReanimatedScrollEvent) {
    "worklet"
    scrollOffset.value = event.contentOffset.y
    scrollContentHeight.value = event.contentSize.height
  }

  const selectionSize = useDerivedValue(() => {
    return Object.keys(selectedItems.value).length
  })

  const selectionHas = (id: string) => {
    return !!selectedItems.value[id]
  }

  const selectJS = (id: string) => {
    runOnUI(select)(id)
  }

  const selectionClear = () => {
    selectedItems.value = {}
  }

  const deselectJS = (id: string) => {
    if (!selectionHas(id)) return false
    runOnUI(deselect)(id)
    return true
  }

  return {
    onScroll,
    gestures: {
      createItemPressHandler,
      panHandler,
    },
    selection: {
      active: selectModeActive,
      add: selectJS,
      clear: selectionClear,
      delete: deselectJS,
      has: selectionHas,
      size: selectionSize,
    },
  }
}

function getPropertyByPath<T extends Record<string, unknown>>(
  object: T,
  path: string
): string {
  "worklet"
  let keys = path.split(".")
  let property: unknown
  do {
    const key = keys.shift()
    if (key) {
      property = object[key]
    }
  } while (keys.length !== 0)
  return property as string
}
