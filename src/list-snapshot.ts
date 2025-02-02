import {
  calculateScrolledCells,
  createLayoutContext,
  distanceToFirstCell,
  getBreakpoints,
  getListColumnRowCount,
  type Inset,
  type ListConfig,
  type ListLayout,
  type PanEvent,
  type ScrollEvent,
} from "./bounds"

export interface ListSnapshot {
  safePanX: number
  safePanY: number
  breakpointsX: Array<number> | null
  breakpointsY: Array<number> | null
  numRows: number
  numColumns: number
  rowBeginsAtIndex: number
  columnBeginsAtIndex: number
  horizontal: boolean
}

// It would be nice to work with a stateful object/class, as opposed to passing
// many arguments around. Refactor this once worklet objects or classes are stable.
// See https://docs.swmansion.com/react-native-reanimated/docs/reanimated-babel-plugin/about/#experimental-worklet-classes
export function createListSnapshot(
  e: PanEvent,
  inset: Inset,
  listConfig: ListConfig,
  listLayout: ListLayout,
  listScroll: ScrollEvent
): ListSnapshot | null {
  "worklet"
  if (e.y > listLayout.height) return null

  const ctx = createLayoutContext(listConfig, listScroll, inset, e)

  const listVerticalMeta = distanceToFirstCell(
    listScroll.offsetY,
    inset.top,
    ctx.config.itemHeight,
    ctx.cellHeight
  )
  const listHorizontalMeta = distanceToFirstCell(
    listScroll.offsetX,
    inset.left,
    ctx.config.itemWidth,
    ctx.cellWidth
  )
  const { numColumns, numRows } = getListColumnRowCount(
    listConfig.horizontal,
    listConfig.numRows,
    listConfig.numColumns,
    listLayout,
    ctx
  )

  const scrolledRows = listVerticalMeta.scrolledPastInset
    ? calculateScrolledCells(
        listScroll.offsetY,
        inset.top,
        ctx.config.itemHeight,
        ctx.cellHeight
      )
    : 0
  const scrolledColumns = listHorizontalMeta.scrolledPastInset
    ? calculateScrolledCells(
        listScroll.offsetX,
        inset.left,
        ctx.config.itemWidth,
        ctx.cellWidth
      )
    : 0

  const breakpointsX = getBreakpoints(
    numColumns,
    ctx.safePanX,
    listHorizontalMeta,
    ctx.config.itemWidth,
    ctx.cellWidth,
    listConfig.columnGap,
    listConfig.horizontal
  )
  const breakpointsY = getBreakpoints(
    numRows,
    ctx.safePanY,
    listVerticalMeta,
    ctx.config.itemHeight,
    ctx.cellHeight,
    listConfig.rowGap,
    listConfig.horizontal
  )

  const rowBeginsAtIndex = scrolledRows * numColumns
  const columnBeginsAtIndex = scrolledColumns * numRows

  return {
    rowBeginsAtIndex,
    columnBeginsAtIndex,
    safePanY: ctx.safePanY,
    safePanX: ctx.safePanX,
    breakpointsY,
    breakpointsX,
    numRows,
    numColumns,
    horizontal: listConfig.horizontal,
  }
}

export function indexForSnapshot(snapshot: ListSnapshot): number | null {
  "worklet"
  const {
    safePanX,
    safePanY,
    breakpointsX,
    breakpointsY,
    numRows,
    numColumns,
    rowBeginsAtIndex,
    columnBeginsAtIndex,
  } = snapshot

  if (!breakpointsX || !breakpointsY) return null

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
  if (indexLowX === -1 || indexLowY === -1) return null

  const lowY = breakpointsY[indexLowY]!
  const highY = breakpointsY[indexHighY]!
  const lowX = breakpointsX[indexLowX]!
  const highX = breakpointsX[indexHighX]!
  const withinX = safePanX >= lowX && safePanX <= highX
  const withinY = safePanY >= lowY && safePanY <= highY

  if (!withinY || !withinX) return null

  const calculateIndex = (rowIndex: number, colIndex: number) => {
    const arraysStartAtZero = 1
    if (snapshot.horizontal) {
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

  return calculateIndex(indexHighY, indexHighX)
}
