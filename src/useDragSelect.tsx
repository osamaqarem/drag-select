import { Platform, useWindowDimensions } from "react-native"
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

export function useDragSelect<ListItem extends Record<string, unknown>>(
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
    rowSeparatorHeight,
    columnSeparatorWidth,
    itemSize: { height: itemHeight, width: itemWidth },
  } = config.list

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
    absoluteX: number
    translationX: number
    translationY: number
  } | null>(null)

  const listLayout = useSharedValue<MeasuredDimensions | null>(null)

  const scrollContentHeight = useSharedValue(0)
  const scrollOffset = useSharedValue(0)

  const { width: deviceWidth, height: deviceHeight } = useWindowDimensions()

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
    runOnJS(onItemSelected)(item)
  }

  function deselect(id: string) {
    "worklet"
    const item = selectedItems.value[id]
    if (!item) return
    selectedItems.modify((state) => {
      delete state[id]
      return state
    })
    runOnJS(onItemDeselected)(item)
  }

  function handleDragSelect(e: { y: number; absoluteX: number }) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !data) return
    if (!axisId.value && __DEV__) {
      throw new Error("handleDragSelect: axisId was not set.")
    }

    const inset = {
      top: listLayout.value.pageY,
      bottom: deviceHeight - listLayout.value.pageY - listLayout.value.height,
      left: listLayout.value.pageX,
      right: deviceWidth - listLayout.value.pageX - listLayout.value.width,
    }

    const windowHeight = listLayout.value.height

    const cellHeight = itemHeight + rowSeparatorHeight
    const cellWidth = itemWidth + columnSeparatorWidth

    const numItemsYAxis = Math.ceil(windowHeight / cellHeight)
    const numItemsXAxis = numColumns

    // account for top padding
    const topOffset = Math.max(0, inset.top - scrollOffset.value)
    const safeTopPanY = e.y - topOffset

    if (safeTopPanY < 0) return // panning in top padding

    // account for bottom padding
    const safeScrollableWindow = Math.max(
      scrollContentHeight.value - windowHeight - inset.bottom,
      0
    )
    const safeAreaPanY =
      scrollOffset.value >= safeScrollableWindow
        ? Math.min(safeTopPanY, windowHeight - inset.bottom)
        : safeTopPanY
    if (safeTopPanY !== safeAreaPanY) return // panning in bottom padding

    // account for a row item being cut-off when scroll offset is not 0
    const scrolledPastTopInset = scrollOffset.value >= inset.top
    const breakpointYoffset = scrolledPastTopInset
      ? cellHeight - ((scrollOffset.value - inset.top) % cellHeight)
      : 0

    const panningBackwardsY = (panEvent.value?.translationY ?? 0) < 0
    let breakpointsY = Array.from({ length: numItemsYAxis }).map((_, index) => {
      if (panningBackwardsY) {
        // When panning from axis cell then upwards
        return (index + 1) * cellHeight + breakpointYoffset - rowSeparatorHeight
      }
      return (index + 1) * cellHeight + breakpointYoffset
    })
    if (breakpointYoffset > 0) {
      breakpointsY.unshift(breakpointYoffset)
    }
    breakpointsY.unshift(0)

    const panningBackwardsX = (panEvent.value?.translationX ?? 0) < 0
    let breakpointsX = Array.from({ length: numItemsXAxis }).map((_, index) => {
      if (panningBackwardsX) {
        // When panning from axis cell then to the left
        return (index + 1) * cellWidth - columnSeparatorWidth
      }
      return (index + 1) * cellWidth
    })
    breakpointsX.unshift(0)

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
      safeAreaPanY,
      breakpointsY
    )
    let [indexLowX, indexHighX] = getBreakpointBoundsIndices(
      e.absoluteX,
      breakpointsX
    )
    const lowY = breakpointsY[indexLowY] ?? -1
    const highY = breakpointsY[indexHighY] ?? -1
    const lowX = breakpointsX[indexLowX] ?? -1
    const highX = breakpointsX[indexHighX] ?? -1

    const withinX = e.absoluteX >= lowX && e.absoluteX <= highX
    const withinY = safeAreaPanY >= lowY && safeAreaPanY <= highY

    if (withinY && withinX) {
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

      const item = itemAt(itemIndex)
      if (!item) return

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
  }

  const { setActive: setFrameCbActive } = useFrameCallback(() => {
    if (!panEvent.value || !selectModeActive.value || !listLayout.value) {
      return
    }
    const { absoluteX, y } = panEvent.value

    handleDragSelect({ absoluteX, y })

    if (!panScrollEnabled) return
    const windowHeight = listLayout.value.height
    const endEdgeThreshold = windowHeight * panScrollEndThreshold
    const startEdgeThreshold = windowHeight * panScrollStartThreshold

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
    } else {
      runOnJS(onItemPress)(tapped)
    }
  }

  const panHandler = Gesture.Pan()
    .activateAfterLongPress(selectModeActive.value ? 0 : longPressMinDurationMs)
    .onStart(() => {
      measureListLayout()
      runOnJS(setFrameCbActive)(true)
    })
    .onUpdate((e) => {
      panEvent.value = {
        y: e.y,
        absoluteX: e.absoluteX,
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
