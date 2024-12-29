import { useCallback, useMemo } from "react"
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
): DragSelect {
  const {
    data,
    key: keyPath,
    onItemPress,
    onItemSelected,
    onItemDeselected,
  } = config

  const {
    animatedRef,
    numColumns: configNumColumns = 1,
    numRows: configNumRows = 1,
    rowGap = 0,
    columnGap = 0,
    itemSize: { height: itemHeight, width: itemWidth },
    contentInset,
    horizontal = false,
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
    resetSelectionOnStart: panResetSelectionOnStart = false,
    scrollEnabled: panScrollEnabled = true,
    scrollEndThreshold: panScrollEndThreshold = 0.85,
    scrollStartThreshold: panScrollStartThreshold = 0.15,
    scrollEndMaxVelocity: panScrollEndMaxVelocity = Platform.select({
      default: 8,
      android: 1,
    }),
    scrollStartMaxVelocity: panScrollStartMaxVelocity = Platform.select({
      default: 8,
      android: 1,
    }),
  } = config.panGesture ?? {}

  const { selectOnTapEnabled: tapGestureSelectOnTapEnabled = true } =
    config.tapGesture ?? {}

  function getId(item: ListItem) {
    "worklet"
    return getPropertyByPath(item, keyPath)
  }

  const itemIndexById = useDerivedValue<Map<string, number>>(
    () => new Map(data.map((d, idx) => [getId(d) as string, idx] as const))
  )
  const itemIdByIndex = useDerivedValue<Map<number, string>>(
    () => new Map(data.map((d, idx) => [idx, getId(d) as string] as const))
  )

  // Refactor once Reanimated has better support for `Map` & `Set`
  const selectedItemMap = useSharedValue<Record<string, number>>({})
  const selectionSize = useDerivedValue(() => {
    return Object.keys(selectedItemMap.value).length
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
  const listScroll = useSharedValue({
    contentHeight: 0,
    contentWidth: 0,
    offsetY: 0,
    offsetX: 0,
  })

  const measureListLayout = useCallback(() => {
    "worklet"
    listLayout.value = measure(animatedRef)
    if (!listLayout.value && __DEV__) {
      throw new Error(
        "drag-select: Failed to measure layout: `measure` returned `null`"
      )
    }
  }, [animatedRef, listLayout])

  function select(id: string) {
    "worklet"
    const itemIndex = itemIndexById.value.get(id)
    if (itemIndex === undefined) return
    const inSelection = selectedItemMap.value[id]
    if (inSelection !== undefined) return
    selectedItemMap.modify((state) => {
      // @ts-expect-error `state` is generic
      state[id] = itemIndex
      return state
    })
    if (onItemSelected) runOnJS(onItemSelected)(id, itemIndex)
  }

  function deselect(id: string) {
    "worklet"
    const itemIndex = selectedItemMap.value[id]
    if (itemIndex === undefined) return
    selectedItemMap.modify((state) => {
      delete state[id]
      return state
    })
    if (onItemDeselected) runOnJS(onItemDeselected)(id, itemIndex)
  }

  const selectionClear = useCallback(() => {
    "worklet"
    selectedItemMap.value = {}
  }, [selectedItemMap])

  function handleDragSelect(e: NonNullable<typeof panEvent.value>) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !axisItem.value) return

    const axisId = axisItem.value.id
    const axisIndex = axisItem.value.index

    const inset = {
      top: insetTop,
      bottom:
        listScroll.value.contentHeight - listScroll.value.offsetY - insetBottom,
      left: insetLeft,
      right:
        listScroll.value.contentWidth - listScroll.value.offsetX - insetRight,
    }

    const cellHeight = itemHeight + rowGap
    const cellWidth = itemWidth + columnGap

    const insetTopWithScroll = Math.max(0, inset.top - listScroll.value.offsetY)
    const safePanY = e.y - insetTopWithScroll
    const insetLeftWithScroll = Math.max(
      0,
      inset.left - listScroll.value.offsetX
    )
    const safePanX = e.x - insetLeftWithScroll

    // noop when panning in top or bottom padding (outside list items)
    if (safePanY < 0 || safePanX < 0 || e.y > listLayout.value.height) return

    // account for a row being cut-off when scroll offset y is not 0
    const scrolledPastTopInset = listScroll.value.offsetY >= inset.top
    const firstFullyVisibleRowStart = scrolledPastTopInset
      ? cellHeight - ((listScroll.value.offsetY - inset.top) % cellHeight)
      : 0
    const firstRowHeightRemainder = scrolledPastTopInset
      ? Math.max(
          itemHeight - ((listScroll.value.offsetY - inset.top) % cellHeight),
          0
        )
      : 0
    const isFirstRowCutOff = firstRowHeightRemainder > 0

    // account for a column being cut-off when scroll offset x is not 0
    const scrolledPastLeftInset = listScroll.value.offsetX >= inset.left
    const firstFullyVisibleColumnStart = scrolledPastLeftInset
      ? cellWidth - ((listScroll.value.offsetX - inset.left) % cellWidth)
      : 0
    const firstColumnWidthRemainder = scrolledPastLeftInset
      ? Math.max(
          itemWidth - ((listScroll.value.offsetX - inset.left) % cellWidth),
          0
        )
      : 0
    const isFirstColumnCutOff = firstColumnWidthRemainder > 0

    const windowHeight = listLayout.value.height
    const windowWidth = listLayout.value.width
    const numRows = horizontal
      ? configNumRows
      : // +1 is to account for a partially visible row at the bottom and top of the list
        // we only care that this value is higher than the correct number of rows for now.
        Math.ceil(windowHeight / cellHeight) + 1
    const numColumns = horizontal
      ? Math.ceil(windowWidth / cellWidth) + 1
      : configNumColumns

    const scrolledRows = (() => {
      if (!scrolledPastTopInset) return 0

      const normalizedScroll = listScroll.value.offsetY - inset.top
      const remainder = normalizedScroll % cellHeight
      if (
        remainder === 0 &&
        normalizedScroll >= itemHeight &&
        normalizedScroll < cellHeight
      ) {
        return 1
      } else if (remainder >= itemHeight) {
        return Math.floor(normalizedScroll / cellHeight) + 1
      }
      return Math.floor(normalizedScroll / cellHeight)
    })()

    const scrolledColumns = (() => {
      if (!scrolledPastLeftInset) return 0

      const normalizedScroll = listScroll.value.offsetX - inset.left
      const remainder = normalizedScroll % cellWidth
      if (
        remainder === 0 &&
        normalizedScroll >= itemWidth &&
        normalizedScroll < cellWidth
      ) {
        return 1
      } else if (remainder >= itemWidth) {
        return Math.floor(normalizedScroll / cellWidth) + 1
      }
      return Math.floor(normalizedScroll / cellWidth)
    })()

    const rowBeginsAtIndex = scrolledRows * numColumns
    const columnBeginsAtIndex = scrolledColumns * numRows

    let boundingRectsX = Array.from({ length: numColumns }).map((_, index) => {
      let minX = isFirstColumnCutOff
        ? firstColumnWidthRemainder + columnGap + (index - 1) * cellWidth
        : firstFullyVisibleColumnStart + index * cellWidth
      minX = index === 0 && isFirstColumnCutOff ? 0 : minX

      let maxX = minX + cellWidth
      maxX =
        index === 0 && isFirstColumnCutOff ? firstColumnWidthRemainder : maxX

      const actualItemWidth =
        index === 0 && isFirstColumnCutOff
          ? firstColumnWidthRemainder
          : cellWidth
      return {
        minX,
        maxX,
        center: minX + actualItemWidth / 2,
      }
    })

    let boundingRectsY = Array.from({ length: numRows }).map((_, index) => {
      let minY = isFirstRowCutOff
        ? firstRowHeightRemainder + rowGap + (index - 1) * cellHeight
        : firstFullyVisibleRowStart + index * cellHeight
      minY = index === 0 && isFirstRowCutOff ? 0 : minY

      let maxY = minY + cellHeight
      maxY = index === 0 && isFirstRowCutOff ? firstRowHeightRemainder : maxY

      const actualItemHeight =
        index === 0 && isFirstRowCutOff ? firstRowHeightRemainder : cellHeight
      return {
        minY,
        maxY,
        center: minY + actualItemHeight / 2,
      }
    })

    const axisXBoundingRect = boundingRectsX.find((rect) => {
      return rect.minX <= safePanX && safePanX <= rect.maxX
    })
    if (!axisXBoundingRect) return
    const isPanningLeftOfAxis = safePanX <= axisXBoundingRect.center

    const axisYBoundingRect = boundingRectsY.find((rect) => {
      return rect.minY <= safePanY && safePanY <= rect.maxY
    })
    if (!axisYBoundingRect) return
    const isPanningTopOfAxis = safePanY <= axisYBoundingRect.center

    let breakpointsX = Array.from({ length: numColumns }).map((_, index) => {
      if (scrolledPastLeftInset) {
        const factor = isFirstColumnCutOff
          ? firstColumnWidthRemainder
          : firstFullyVisibleColumnStart + itemWidth

        if (isPanningLeftOfAxis) {
          return index * cellWidth + factor
        } else {
          return index * cellWidth + columnGap + factor
        }
      } else {
        if (isPanningLeftOfAxis) {
          return itemWidth + index * cellWidth
        }
        return (index + 1) * cellWidth + firstFullyVisibleColumnStart
      }
    })
    breakpointsX.unshift(isFirstColumnCutOff ? 0 : firstFullyVisibleColumnStart)

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
      if (horizontal) {
        return (
          colIndex * numRows -
          (numRows - rowIndex) +
          columnBeginsAtIndex -
          arraysStartAtZero
        )
      }
      return (
        rowIndex * numColumns -
        (numColumns - colIndex) +
        rowBeginsAtIndex -
        arraysStartAtZero
      )
    }

    const itemIndex = calculateIndex(indexHighY, indexHighX)

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
      const id = itemIdByIndex.value.get(i)
      if (!id) return
      select(id)
    }
    const deselectItemAtIndex = (i: number) => {
      const id = itemIdByIndex.value.get(i)
      if (!id) return
      if (axisId === id) return
      deselect(id)
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
    const windowDimension = horizontal
      ? listLayout.value.width
      : listLayout.value.height

    const endEdgeThreshold = windowDimension * panScrollEndThreshold
    const startEdgeThreshold = windowDimension * panScrollStartThreshold

    const { x, y } = panEvent.value
    const pan = horizontal ? x : y
    const scrollOffset = horizontal
      ? listScroll.value.offsetX
      : listScroll.value.offsetY

    const scrollToPosition = (offset: number) => {
      if (horizontal) {
        scrollTo(animatedRef, offset, 0, false)
      } else {
        scrollTo(animatedRef, 0, offset, false)
      }
    }

    if (pan > endEdgeThreshold) {
      const inputRange = [endEdgeThreshold, windowDimension]
      const outputRange = [0, panScrollEndMaxVelocity]
      const result = interpolate(pan, inputRange, outputRange)
      const offset = scrollOffset + result
      scrollToPosition(offset)
    } else if (scrollOffset > 0 && pan < startEdgeThreshold) {
      const inputRange = [startEdgeThreshold, 0]
      const outputRange = [0, panScrollStartMaxVelocity]
      const result = interpolate(pan, inputRange, outputRange)
      const offset = scrollOffset - result
      scrollToPosition(offset)
    }
  }, false)

  function longPressOnStart(id: string) {
    "worklet"
    const index = itemIndexById.value.get(id)
    if (index === undefined) return
    const inSelection = selectedItemMap.value[id]
    if (inSelection !== undefined) return
    axisItem.value = { id, index }
    select(id)
  }

  function tapOnStart(id: string, index: number) {
    "worklet"
    if (!itemIndexById.value.has(id)) return
    if (tapGestureSelectOnTapEnabled && selectModeActive.value) {
      const inSelection = selectedItemMap.value[id]
      if (inSelection !== undefined) {
        deselect(id)
      } else {
        select(id)
      }
    } else if (onItemPress) {
      runOnJS(onItemPress)(id, index)
    }
  }

  const panHandler = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activateAfterLongPress(longPressMinDurationMs)
        .onStart(() => {
          if (panResetSelectionOnStart) {
            selectionClear()
          }
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
        }),
    [
      longPressMinDurationMs,
      measureListLayout,
      panEvent,
      panResetSelectionOnStart,
      panTransitionFromIndex,
      selectionClear,
      setFrameCbActive,
    ]
  )

  function createItemPressHandler(id: string, index: number) {
    // The minimum value for either min/max duration for a gesture is 1.
    const tapGestureMaxDuration = Math.max(longPressMinDurationMs - 1, 1)

    const tapGesture = Gesture.Tap()
      .maxDuration(tapGestureMaxDuration)
      .onStart(() => tapOnStart(id, index))

    const longPressGesture = Gesture.LongPress()
      .minDuration(tapGestureMaxDuration + 1)
      .onStart(() => longPressOnStart(id))
      .simultaneousWithExternalGesture(panHandler)
      .enabled(longPressGestureEnabled)

    return Gesture.Simultaneous(tapGesture, longPressGesture)
  }

  function onScroll(event: ReanimatedScrollEvent) {
    "worklet"
    listScroll.value = {
      contentHeight: event.contentSize.height,
      contentWidth: event.contentSize.width,
      offsetY: event.contentOffset.y,
      offsetX: event.contentOffset.x,
    }
  }

  const selectionHasOnJS = (id: string) => {
    return selectedItemMap.value[id] !== undefined
  }
  const selectionHas = (id: string) => {
    "worklet"
    return selectedItemMap.value[id] !== undefined
  }

  const selectOnJS = (id: string) => {
    runOnUI(select)(id)
  }

  const selectionClearOnJS = () => {
    selectedItemMap.value = {}
  }

  const deselectOnJS = (id: string) => {
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
      add: selectOnJS,
      clear: selectionClearOnJS,
      delete: deselectOnJS,
      has: selectionHasOnJS,
      size: selectionSize,
      items: selectedItemMap,
      ui: {
        add: select,
        delete: deselect,
        clear: selectionClear,
        has: selectionHas,
      },
    },
  }
}
