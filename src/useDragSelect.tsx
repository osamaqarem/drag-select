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
import { getPropertyByPath } from "./property-paths"
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

  const itemMap = useDerivedValue<Map<string, ListItem>>(
    () => new Map(data.map((d) => [getId(d) as string, d]))
  )

  const selectedItems = useSharedValue<Record<string, ListItem>>({})
  const selectionSize = useDerivedValue(() => {
    return Object.keys(selectedItems.value).length
  })
  const selectModeActive = useDerivedValue(() => selectionSize.value > 0)

  const axisItem = useSharedValue<{ id: string; index: number } | null>(null)
  const panTransitionFromIndex = useSharedValue<number | null>(null)
  const panEvent = useSharedValue<{
    y: number
    x: number
    translationX: number
    translationY: number
  } | null>(null)

  const listLayout = useSharedValue<MeasuredDimensions | null>(null)
  const listScroll = useSharedValue({ contentHeight: 0, offset: 0 })

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

  function handleDragSelect(e: NonNullable<typeof panEvent.value>) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !axisItem.value) return

    const axisId = axisItem.value.id
    const axisIndex = axisItem.value.index

    const inset = {
      top: insetTop,
      bottom:
        listScroll.value.contentHeight - listScroll.value.offset - insetBottom,
      left: insetLeft,
      right: insetRight,
    }

    const cellHeight = itemHeight + rowGap
    const cellWidth = itemWidth + columnGap

    const insetTopWithScroll = Math.max(0, inset.top - listScroll.value.offset)
    const safePanY = e.y - insetTopWithScroll
    const safePanX = e.x

    // noop when panning in top or bottom padding (outside list items)
    if (safePanY < 0 || e.y > listLayout.value.height) return

    // account for a row item being cut-off when scroll offset is not 0
    const scrolledPastTopInset = listScroll.value.offset >= inset.top
    const firstFullyVisibleRowStart = scrolledPastTopInset
      ? cellHeight - ((listScroll.value.offset - inset.top) % cellHeight)
      : 0
    const firstRowHeightRemainder = scrolledPastTopInset
      ? Math.max(
          itemHeight - ((listScroll.value.offset - inset.top) % cellHeight),
          0
        )
      : 0
    const isFirstRowCutOff = firstRowHeightRemainder > 0

    const moduloColumnsAxisIndex = axisIndex % numColumns
    const isAxisFirstColumn = moduloColumnsAxisIndex === 0
    const isAxisLastColumn = moduloColumnsAxisIndex === numColumns - 1

    const windowHeight = listLayout.value.height
    // +1 is to account for a partially visible row at the bottom and top of the list
    // we only care that this value is higher than the correct number of rows for now.
    const numRows = Math.ceil(windowHeight / cellHeight) + 1
    const scrolledRows = (() => {
      if (!scrolledPastTopInset) return 0

      const normalizedScroll = listScroll.value.offset - inset.top
      const remainder = normalizedScroll % cellHeight
      if (remainder === 0 && normalizedScroll >= itemHeight) {
        return 1
      } else if (remainder >= itemHeight) {
        return Math.floor(normalizedScroll / cellHeight) + 1
      }
      return Math.floor(normalizedScroll / cellHeight)
    })()
    const rowBeginsAtIndex = scrolledRows * numColumns
    const moduloRowsAxisIndex = Math.max(
      Math.floor(axisIndex / numColumns) - scrolledRows,
      0
    )

    let boundingRectsX = Array.from({ length: numColumns }).map((_, index) => {
      const minX = inset.left + index * cellWidth

      let minY = isFirstRowCutOff
        ? firstRowHeightRemainder + rowGap + (index - 1) * cellHeight
        : firstFullyVisibleRowStart + index * cellHeight
      minY = index === 0 && isFirstRowCutOff ? 0 : minY

      let maxY = minY + itemHeight
      maxY = index === 0 && isFirstRowCutOff ? firstRowHeightRemainder : maxY

      return {
        minY,
        maxY,
        minX,
        maxX: minX + itemWidth,
        center: minX + itemWidth / 2,
      }
    })

    let boundingRectsY = Array.from({ length: numRows }).map((_, index) => {
      let minY = isFirstRowCutOff
        ? firstRowHeightRemainder + rowGap + (index - 1) * cellHeight
        : firstFullyVisibleRowStart + index * cellHeight
      minY = index === 0 && isFirstRowCutOff ? 0 : minY

      let maxY = minY + itemHeight
      maxY = index === 0 && isFirstRowCutOff ? firstRowHeightRemainder : maxY

      const actualItemHeight =
        index === 0 && isFirstRowCutOff ? firstRowHeightRemainder : itemHeight
      return {
        minY,
        maxY,
        center: minY + actualItemHeight / 2,
      }
    })

    const axisXBoundingRect = boundingRectsX[moduloColumnsAxisIndex]
    if (!axisXBoundingRect) return
    const isPanningRightOfAxis = safePanX >= axisXBoundingRect.center

    const axisYBoundingRect = boundingRectsY[moduloRowsAxisIndex]
    if (!axisYBoundingRect) return
    const isPanningTopOfAxis = safePanY <= axisYBoundingRect.center

    let breakpointsX = Array.from({ length: numColumns }).map((_, index) => {
      if (isAxisLastColumn) {
        // may pan left to select
        return inset.left + itemWidth + index * cellWidth
      }
      if (!isAxisFirstColumn && !isAxisLastColumn) {
        // may pan left or right to select
        if (isPanningRightOfAxis) {
          return inset.left + (index + 1) * cellWidth
        }
        return inset.left + itemWidth + index * cellWidth
      }
      // may pan right to select
      return inset.left + (index + 1) * cellWidth
    })
    breakpointsX.unshift(inset.left)

    let breakpointsY = Array.from({ length: numRows }).map((_, index) => {
      if (scrolledPastTopInset) {
        const factor = isFirstRowCutOff
          ? firstRowHeightRemainder
          : firstFullyVisibleRowStart + itemHeight

        if (isPanningTopOfAxis) {
          return index * cellHeight + factor
        } else {
          return index * cellHeight + rowGap + factor
        }
      } else {
        if (isPanningTopOfAxis) {
          return itemHeight + index * cellHeight
        }
        return (index + 1) * cellHeight + firstFullyVisibleRowStart
      }
    })
    breakpointsY.unshift(isFirstRowCutOff ? 0 : firstFullyVisibleRowStart)

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
    if (indexLowX === -1 || indexLowY === -1) return

    const lowY = breakpointsY[indexLowY]!
    const highY = breakpointsY[indexHighY]!
    const lowX = breakpointsX[indexLowX]!
    const highX = breakpointsX[indexHighX]!
    const withinX = safePanX >= lowX && safePanX <= highX
    const withinY = safePanY >= lowY && safePanY <= highY

    if (!withinY || !withinX) return

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
    const fromIndex = panTransitionFromIndex.value
    panTransitionFromIndex.value = toIndex

    if (fromIndex === toIndex) return
    const selectItemAtIndex = (i: number) => {
      const curr = itemAt(i)
      if (!curr) return
      const currId = getId(curr)
      select(currId)
    }
    const deselectItemAtIndex = (i: number) => {
      const curr = itemAt(i)
      if (!curr) return
      const currId = getId(curr)
      if (axisId === currId) return
      deselect(currId)
    }

    const axisRow = Math.floor(axisIndex / numColumns) + 1
    const toRow = Math.floor(itemIndex / numColumns) + 1

    const isAxisRow = toRow === axisRow
    const afterAxisRow = toRow > axisRow
    const beforeAxisRow = toRow < axisRow

    const backwards = toIndex < fromIndex
    const forwards = toIndex > fromIndex

    const beforeAxis = fromIndex < axisIndex

    if (backwards && !beforeAxis) {
      for (let i = fromIndex; i > toIndex; i--) {
        deselectItemAtIndex(i)
      }
    } else if (isAxisRow && forwards && beforeAxis) {
      for (let i = fromIndex; i < toIndex; i++) {
        deselectItemAtIndex(i)
      }
    } else if (!isAxisRow && forwards && beforeAxis) {
      // panning downwards after selecting upwards
      for (let i = fromIndex; i < toIndex; i++) {
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
      const offset = listScroll.value.offset + result
      scrollTo(animatedRef, 0, offset, false)
    } else if (listScroll.value.offset > 0 && y < startEdgeThreshold) {
      const inputRange = [startEdgeThreshold, 0]
      const outputRange = [0, panScrollStartMaxVelocity]
      const result = interpolate(y, inputRange, outputRange)
      const offset = listScroll.value.offset - result
      scrollTo(animatedRef, 0, offset, false)
    }
  }, false)

  function longPressOnStart(id: string, index: number) {
    "worklet"
    const longPressed = itemMap.value.get(id)
    if (!longPressed) return
    const inSelection = selectedItems.value[id]
    if (inSelection) return
    axisItem.value = { id, index }
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

  function createItemPressHandler(item: ListItem, index: number) {
    const tapGesture = Gesture.Tap()
      .maxDuration(longPressMinDurationMs)
      .onStart(() => tapOnStart(getId(item)))

    const longPressGesture = Gesture.LongPress()
      .minDuration(longPressMinDurationMs)
      .onStart(() => longPressOnStart(getId(item), index))
      .simultaneousWithExternalGesture(panHandler)
      .enabled(longPressGestureEnabled)

    return Gesture.Simultaneous(tapGesture, longPressGesture)
  }

  function onScroll(event: ReanimatedScrollEvent) {
    "worklet"
    listScroll.value = {
      contentHeight: event.contentSize.height,
      offset: event.contentOffset.y,
    }
  }

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
