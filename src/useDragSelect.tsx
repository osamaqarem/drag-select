import { FlatList, type LayoutRectangle } from "react-native"
import { Gesture } from "react-native-gesture-handler"
import {
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedScrollHandler,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type AnimatedRef,
} from "react-native-reanimated"

type Item = { id: string }

export interface Config {
  data: Array<Item>
  columnCount: number
  rowSeparatorHeight: number
  columnSeparatorWidth: number
  headerHeight: number
  onItemPress: (item: Item) => void
  onItemSelected: (item: Item) => void
  onItemDeselected: (item: Item) => void
  listRef: AnimatedRef<FlatList>
  gestureConfig: {
    longPressTiming: number
  }
  safeArea: {
    topInset: number
    bottomInset: number
  }
  itemSize: {
    width: number
    height: number
  }
}

export const useDragSelect = (config: Config) => {
  const itemMap = useDerivedValue(
    () => new Map(config.data.map((d) => [d.id, d]))
  )

  const selectedItems = useSharedValue<Record<string, Item>>({})
  const selectedAxisName = useSharedValue("")
  const selectModeActive = useDerivedValue(
    () => Object.keys(selectedItems.value).length > 0
  )

  const panTransitionFromIndex = useSharedValue<number | null>(null)
  const panEvent = useSharedValue({
    y: null as number | null,
    absoluteX: null as number | null,
  })

  const flatlistLayout = useSharedValue<LayoutRectangle | null>(null)

  const scrollContentHeight = useSharedValue(0)
  const scrollOffset = useSharedValue(0)

  const handleDragSelect = (e: { y: number; absoluteX: number }) => {
    "worklet"
    if (!selectModeActive.value || !flatlistLayout.value || !config.data) return

    const {
      columnCount,
      columnSeparatorWidth,
      data,
      headerHeight,
      itemSize,
      rowSeparatorHeight,
      safeArea,
    } = config

    const windowHeight = flatlistLayout.value.height

    const cellHeight = itemSize.height + rowSeparatorHeight
    const cellWidth = itemSize.width + columnSeparatorWidth

    const numItemsYAxis = Math.ceil(windowHeight / cellHeight)
    const numItemsXAxis = columnCount

    const headerArea = headerHeight + safeArea.topInset
    // account for top padding
    const topOffset = Math.max(0, headerArea - scrollOffset.value)
    const safeTopPanY = e.y - topOffset
    if (safeTopPanY < 0) return // panning in top padding

    // account for bottom padding
    const safeScrollableWindow = Math.max(
      scrollContentHeight.value - windowHeight - safeArea.bottomInset,
      0
    )
    const safeAreaPanY =
      scrollOffset.value >= safeScrollableWindow
        ? Math.min(safeTopPanY, windowHeight - safeArea.bottomInset)
        : safeTopPanY
    if (safeTopPanY !== safeAreaPanY) return // panning in bottom padding

    // account for a row item being cut-off when scroll offset not 0
    const headerHidden = scrollOffset.value >= headerArea
    const breakpointYoffset = headerHidden
      ? cellHeight -
        ((scrollOffset.value - safeArea.topInset - headerHeight) % cellHeight)
      : 0

    let breakpointsY: Array<number> = [0]
    let breakpointsX: Array<number> = [0]
    if (breakpointYoffset) breakpointsY.push(breakpointYoffset)

    Array(numItemsYAxis)
      .fill(0)
      .forEach((_, index) => {
        breakpointsY.push((index + 1) * cellHeight + breakpointYoffset)
      })
    Array(numItemsXAxis)
      .fill(0)
      .forEach((_, index) => {
        breakpointsX.push((index + 1) * cellWidth + columnSeparatorWidth)
      })

    const getValueBounds = (
      value: number,
      list: Array<number>
    ): [number, number] => {
      let idx = 0
      for (const breakpoint of list) {
        if (value >= breakpoint) {
          idx += 1
        } else {
          return [idx - 1, idx]
        }
      }
      return [idx - 1, idx]
    }

    let [lowerBoundY, upperBoundY] = getValueBounds(safeAreaPanY, breakpointsY)
    let [lowerBoundX, upperBoundX] = getValueBounds(e.absoluteX, breakpointsX)
    const lowY = breakpointsY[lowerBoundY] ?? -1
    const highY = breakpointsY[upperBoundY] ?? -1
    const lowX = breakpointsX[lowerBoundX] ?? -1
    const highX = breakpointsX[upperBoundX] ?? -1

    const withinX = e.absoluteX >= lowX && e.absoluteX <= highX
    const withinY = safeAreaPanY >= lowY && safeAreaPanY <= highY

    if (withinY && withinX) {
      const scrolledRows = headerHidden
        ? Math.floor(Math.abs((headerArea - scrollOffset.value) / cellHeight))
        : 0
      const rowBeginsAtIndex = scrolledRows * columnCount

      const getArrayIndexForDimensions = (
        rowIndex: number,
        colIndex: number
      ) => {
        const arraysStartAtZero = 1
        return (
          rowIndex * columnCount -
          (columnCount - colIndex) +
          rowBeginsAtIndex -
          arraysStartAtZero
        )
      }

      const itemIndex = getArrayIndexForDimensions(upperBoundY, upperBoundX)

      const getItemFromState = (index: number) => {
        const itemInState = data[index]
        return itemInState ? itemMap.value.get(itemInState.id) : undefined
      }

      const item = getItemFromState(itemIndex)
      if (!item) return

      if (panTransitionFromIndex.value === null) {
        panTransitionFromIndex.value = itemIndex
      }

      /**
       * axis cell: the cell where the long-press starts.
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
        const selectItemAtIndex = (
          i: number,
          mutateObj: Record<string, Item>
        ) => {
          const curr = getItemFromState(i)
          if (curr) {
            const existing = mutateObj[curr.id]
            if (!existing) {
              mutateObj[curr.id] = curr
            }
          }
        }
        const deselectItemAtIndex = (
          i: number,
          mutateObj: Record<string, Item>
        ) => {
          const curr = getItemFromState(i)
          if (curr) {
            const existing = mutateObj[curr.id]
            if (existing && existing.id !== selectedAxisName.value) {
              delete mutateObj[curr.id]
            }
          }
        }

        const fromIndex = panTransitionFromIndex.value

        const axisItem = selectedItems.value[selectedAxisName.value]
        const axisIndex = data.findIndex((d) => d.id === axisItem?.id)

        const axisRow = Math.floor(axisIndex / config.columnCount) + 1
        const toRow = Math.floor(itemIndex / config.columnCount) + 1

        const afterAxisRow = toRow > axisRow
        const isAxisRow = toRow === axisRow

        const backwards = toIndex < fromIndex
        const forwards = toIndex > fromIndex

        let nextSelectedItemsState = { ...selectedItems.value }

        if (axisRow) {
          if (forwards) {
            for (let i = fromIndex; i < toIndex; i++) {
              deselectItemAtIndex(i, nextSelectedItemsState)
            }
          } else if (backwards) {
            for (let i = fromIndex; i > toIndex; i--) {
              deselectItemAtIndex(i, nextSelectedItemsState)
            }
          }
        }

        if (afterAxisRow || (isAxisRow && forwards)) {
          for (let i = axisIndex; i <= toIndex; i++) {
            selectItemAtIndex(i, nextSelectedItemsState)
          }
        } else if (!afterAxisRow || (isAxisRow && backwards)) {
          for (let i = axisIndex; i >= toIndex; i--) {
            selectItemAtIndex(i, nextSelectedItemsState)
          }
        }
        selectedItems.value = nextSelectedItemsState
      }
      panTransitionFromIndex.value = toIndex
    }
  }

  const { setActive: setFrameCbActive } = useFrameCallback(() => {
    const { absoluteX, y } = panEvent.value
    if (
      typeof absoluteX !== "number" ||
      typeof y !== "number" ||
      !selectModeActive.value ||
      !flatlistLayout.value
    ) {
      return
    }
    const windowHeight = flatlistLayout.value.height
    const bottomThreshold = windowHeight * 0.85
    const topThreshold = windowHeight * 0.15

    handleDragSelect({ absoluteX, y })

    if (y > bottomThreshold) {
      const inputRange = [bottomThreshold, windowHeight]
      const outputRange = [0, 8]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value + result
      scrollTo(config.listRef, 0, offset, false)
    } else if (scrollOffset.value > 0 && y < topThreshold) {
      const inputRange = [topThreshold, 0]
      const outputRange = [0, 8]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value - result
      scrollTo(config.listRef, 0, offset, false)
    }
  }, false)

  const longPressOnStart = (id: string) => {
    "worklet"
    const longPressed = itemMap.value.get(id)
    if (!longPressed) return
    if (selectedItems.value[longPressed.id]) return
    const axis = { ...longPressed, isLongPressAxis: true }
    selectedAxisName.value = axis.id
    selectedItems.value = {
      ...selectedItems.value,
      [longPressed.id]: axis,
    }
    runOnJS(config.onItemSelected)(longPressed)
  }

  const tapOnStart = (id: string) => {
    "worklet"
    const tapped = itemMap.value.get(id)
    if (!tapped) return
    if (selectModeActive.value) {
      const item = selectedItems.value[id]
      if (item) {
        delete selectedItems.value[id]
        selectedItems.value = { ...selectedItems.value }
        runOnJS(config.onItemDeselected)(tapped)
      } else {
        selectedItems.value = { ...selectedItems.value, [id]: tapped }
        runOnJS(config.onItemSelected)(tapped)
      }
    } else {
      runOnJS(config.onItemPress)(tapped)
    }
  }

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(config.gestureConfig.longPressTiming)
    .onStart(() => {
      runOnJS(setFrameCbActive)(true)
    })
    .onUpdate((e) => {
      panEvent.value.y = e.y
      panEvent.value.absoluteX = e.absoluteX
    })
    .onEnd(() => {
      panTransitionFromIndex.value = null
      panEvent.value.y = null
      panEvent.value.absoluteX = null
      runOnJS(setFrameCbActive)(false)
    })

  const createListItemGesture = (item: Item) => {
    const tapGesture = Gesture.Tap()
      .maxDuration(config.gestureConfig.longPressTiming)
      .onStart(() => tapOnStart(item.id))

    const longPressGesture = Gesture.LongPress()
      .minDuration(config.gestureConfig.longPressTiming)
      .onStart(() => longPressOnStart(item.id))
      .simultaneousWithExternalGesture(panGesture)

    return Gesture.Simultaneous(tapGesture, longPressGesture)
  }

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffset.value = event.contentOffset.y
    scrollContentHeight.value = event.contentSize.height
  })

  function clearSelection() {
    selectedItems.value = {}
  }

  function onListLayout(e: { nativeEvent: { layout: LayoutRectangle } }) {
    flatlistLayout.value = e.nativeEvent.layout
  }

  return {
    panGesture,
    createListItemGesture,
    clearSelection,
    selectedItems,
    onListLayout,
    scrollHandler,
  }
}
