import { useWindowDimensions } from "react-native"
import { Gesture } from "react-native-gesture-handler"
import {
  interpolate,
  measure,
  runOnJS,
  scrollTo,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type MeasuredDimensions,
} from "react-native-reanimated"
import type { ReanimatedScrollEvent } from "react-native-reanimated/lib/typescript/hook/commonTypes"
import type { Config } from "./types"

export function useDragSelect<
  ListItem extends Record<Key, string>,
  Key extends keyof ListItem,
>(config: Config<ListItem, Key>) {
  const itemMap = useDerivedValue(
    () => new Map(config.data.map((d) => [d[config.key] as string, d]))
  )

  const selectedItems = useSharedValue<Record<string, ListItem>>({})
  const selectedAxisName = useSharedValue("")
  const selectModeActive = useDerivedValue(
    () => Object.keys(selectedItems.value).length > 0
  )

  const panTransitionFromIndex = useSharedValue<number | null>(null)
  const panEvent = useSharedValue({
    y: null as number | null,
    absoluteX: null as number | null,
  })

  const listLayout = useSharedValue<MeasuredDimensions | null>(null)

  const scrollContentHeight = useSharedValue(0)
  const scrollOffset = useSharedValue(0)

  const { width: deviceWidth, height: deviceHeight } = useWindowDimensions()

  function maybeMeasureListLayout() {
    "worklet"
    // This is 'memoized' for now, but we likely need to support dynamic layouts.
    if (listLayout.value) return
    listLayout.value = measure(config.list.animatedRef)
    if (!listLayout.value) {
      throw new Error("Failed to measure layout: `measure` returned `null`")
    }
  }

  function handleDragSelect(e: { y: number; absoluteX: number }) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !config.data) return

    const {
      data,
      list: { numColumns, columnSeparatorWidth, itemSize, rowSeparatorHeight },
    } = config

    const inset = {
      top: listLayout.value.pageY,
      bottom: deviceHeight - listLayout.value.pageY - listLayout.value.height,
      left: listLayout.value.pageX,
      right: deviceWidth - listLayout.value.pageX - listLayout.value.width,
    }

    const windowHeight = listLayout.value.height

    const cellHeight = itemSize.height + rowSeparatorHeight
    const cellWidth = itemSize.width + columnSeparatorWidth

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
      const scrolledRows = scrolledPastTopInset
        ? Math.floor(Math.abs((inset.top - scrollOffset.value) / cellHeight))
        : 0
      const rowBeginsAtIndex = scrolledRows * numColumns

      const getArrayIndexForDimensions = (
        rowIndex: number,
        colIndex: number
      ) => {
        const arraysStartAtZero = 1
        return (
          rowIndex * numColumns -
          (numColumns - colIndex) +
          rowBeginsAtIndex -
          arraysStartAtZero
        )
      }

      const getId = (rec: Record<Key, string>) => rec[config.key]

      const itemIndex = getArrayIndexForDimensions(upperBoundY, upperBoundX)

      const getItemFromState = (index: number) => {
        const itemInState = data[index]
        if (!itemInState) return undefined
        const id = getId(itemInState)
        return itemMap.value.get(id)
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
          mutateObj: Record<string, ListItem>
        ) => {
          const curr = getItemFromState(i)
          if (curr) {
            const existing = mutateObj[getId(curr)]
            if (!existing) {
              mutateObj[getId(curr)] = curr
            }
          }
        }
        const deselectItemAtIndex = (
          i: number,
          mutateObj: Record<string, ListItem>
        ) => {
          const curr = getItemFromState(i)
          if (curr) {
            const existing = mutateObj[getId(curr)]
            if (existing && getId(existing) !== selectedAxisName.value) {
              delete mutateObj[getId(curr)]
            }
          }
        }

        const fromIndex = panTransitionFromIndex.value

        const axisItem = selectedItems.value[selectedAxisName.value]
        const axisIndex = data.findIndex(
          (d) => getId(d) === axisItem?.[config.key]
        )

        const axisRow = Math.floor(axisIndex / numColumns) + 1
        const toRow = Math.floor(itemIndex / numColumns) + 1

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
    maybeMeasureListLayout()

    const { absoluteX, y } = panEvent.value
    if (
      typeof absoluteX !== "number" ||
      typeof y !== "number" ||
      !selectModeActive.value ||
      !listLayout.value
    ) {
      return
    }

    const windowHeight = listLayout.value.height
    const bottomThreshold = windowHeight * 0.85
    const topThreshold = windowHeight * 0.15

    handleDragSelect({ absoluteX, y })

    if (y > bottomThreshold) {
      const inputRange = [bottomThreshold, windowHeight]
      const outputRange = [0, 8]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value + result
      scrollTo(config.list.animatedRef, 0, offset, false)
    } else if (scrollOffset.value > 0 && y < topThreshold) {
      const inputRange = [topThreshold, 0]
      const outputRange = [0, 8]
      const result = interpolate(y, inputRange, outputRange)
      const offset = scrollOffset.value - result
      scrollTo(config.list.animatedRef, 0, offset, false)
    }
  }, false)

  function longPressOnStart(id: string) {
    "worklet"
    const getId = (rec: Record<Key, string>) => rec[config.key]

    const longPressed = itemMap.value.get(id)
    if (!longPressed) return
    if (selectedItems.value[getId(longPressed)]) return
    const axis = { ...longPressed, isLongPressAxis: true }
    selectedAxisName.value = getId(axis)
    selectedItems.value = {
      ...selectedItems.value,
      [getId(longPressed)]: axis,
    }
    runOnJS(config.onItemSelected)(longPressed)
  }

  function tapOnStart(id: string) {
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

  const panHandler = Gesture.Pan()
    .activateAfterLongPress(config.gestures.longPressDurationMs)
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

  function createItemPressHandler(item: ListItem) {
    const tapGesture = Gesture.Tap()
      .maxDuration(config.gestures.longPressDurationMs)
      .onStart(() => tapOnStart(item[config.key]))

    const longPressGesture = Gesture.LongPress()
      .minDuration(config.gestures.longPressDurationMs)
      .onStart(() => longPressOnStart(item[config.key]))
      .simultaneousWithExternalGesture(panHandler)

    return Gesture.Simultaneous(tapGesture, longPressGesture)
  }

  function handleScrollEvent(event: ReanimatedScrollEvent) {
    "worklet"
    scrollOffset.value = event.contentOffset.y
    scrollContentHeight.value = event.contentSize.height
  }

  function clearSelection() {
    selectedItems.value = {}
  }

  return {
    clearSelection,
    selectedItems: selectedItems as Readonly<{
      value: Record<string, ListItem>
    }>,
    handleScrollEvent,
    gestures: {
      panHandler,
      createItemPressHandler,
    },
  }
}
