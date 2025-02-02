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

import type { PanEvent } from "./bounds"
import {
  createListSnapshot,
  indexForSnapshot,
  type ListSnapshot,
} from "./list-snapshot"
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

  const getListSnapshot = useCallback(
    (e: PanEvent): ListSnapshot | null => {
      "worklet"
      if (!listLayout.value) return null

      const inset = {
        top: insetTop,
        right: insetRight,
        bottom: insetBottom,
        left: insetLeft,
      }
      const listConfig = {
        itemWidth,
        itemHeight,
        numRows: configNumRows,
        numColumns: configNumColumns,
        rowGap,
        columnGap,
        horizontal,
      }
      const listSnapshot = createListSnapshot(
        e,
        inset,
        listConfig,
        listLayout.value,
        listScroll.value
      )
      if (!listSnapshot?.breakpointsX || !listSnapshot?.breakpointsY) {
        return null
      }
      return listSnapshot
    },
    [
      columnGap,
      configNumColumns,
      configNumRows,
      horizontal,
      insetBottom,
      insetLeft,
      insetRight,
      insetTop,
      itemHeight,
      itemWidth,
      listLayout,
      listScroll,
      rowGap,
    ]
  )

  const select = useCallback(
    (id: string) => {
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
    },
    [itemIndexById, onItemSelected, selectedItemMap]
  )

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

  function handleDragSelect(e: PanEvent) {
    "worklet"
    if (!selectModeActive.value || !listLayout.value || !axisItem.value) return

    const axisId = axisItem.value.id
    const axisIndex = axisItem.value.index

    const listSnapshot = getListSnapshot(e)
    if (!listSnapshot) return

    const itemIndex = indexForSnapshot(listSnapshot)
    if (typeof itemIndex !== "number") return

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

    const axisRow = Math.floor(axisIndex / listSnapshot.numColumns) + 1
    const toRow = Math.floor(itemIndex / listSnapshot.numColumns) + 1

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

  const panHandler = useMemo(() => {
    const gesture = Gesture.Pan()
      .maxPointers(1)
      .onStart((e) => {
        measureListLayout()
        if (!listLayout.value) return

        const listSnapshot = getListSnapshot(e)
        if (!listSnapshot) return

        const axisIndex = indexForSnapshot(listSnapshot)
        if (typeof axisIndex !== "number") return
        const id = itemIdByIndex.value.get(axisIndex)
        if (id === undefined) return

        if (panResetSelectionOnStart) {
          selectionClear()
        }

        axisItem.value = { id, index: axisIndex }
        select(id)

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
        axisItem.value = null
        panTransitionFromIndex.value = null
        panEvent.value = null
        runOnJS(setFrameCbActive)(false)
      })

    if (longPressGestureEnabled) {
      gesture.activateAfterLongPress(longPressMinDurationMs)
    }

    return gesture
  }, [
    axisItem,
    getListSnapshot,
    itemIdByIndex.value,
    listLayout.value,
    longPressGestureEnabled,
    longPressMinDurationMs,
    measureListLayout,
    panEvent,
    panResetSelectionOnStart,
    panTransitionFromIndex,
    select,
    selectionClear,
    setFrameCbActive,
  ])

  function createItemPressHandler(id: string, index: number) {
    // The minimum value for either min/max duration for a gesture is 1.
    const tapGestureMaxDuration = Math.max(longPressMinDurationMs - 1, 1)

    const tapGesture = Gesture.Tap()
      .maxDuration(tapGestureMaxDuration)
      .onStart(() => tapOnStart(id, index))
    return tapGesture
  }

  function onScroll(event: {
    contentSize: { height: number; width: number }
    contentOffset: { y: number; x: number }
  }) {
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
