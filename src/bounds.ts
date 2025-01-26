export interface Inset {
  top: number
  bottom: number
  left: number
  right: number
}

export interface ListLayout {
  width: number
  height: number
}

export interface ScrollEvent {
  contentHeight: number
  contentWidth: number
  offsetX: number
  offsetY: number
}

export interface PanEvent {
  y: number
  x: number
}

export interface ListConfig {
  itemWidth: number
  itemHeight: number
  numRows: number
  numColumns: number
  rowGap: number
  columnGap: number
  horizontal: boolean
}

export function createLayoutContext(
  listConfig: ListConfig,
  listScroll: ScrollEvent,
  inset: Inset,
  panEvent: PanEvent
) {
  "worklet"
  const scrollBasedInsetTop = Math.max(0, inset.top - listScroll.offsetY)
  const scrollBasedInsetLeft = Math.max(0, inset.left - listScroll.offsetX)

  const cellHeight = listConfig.itemHeight + listConfig.rowGap
  const cellWidth = listConfig.itemWidth + listConfig.columnGap
  const safePanY = Math.max(panEvent.y - scrollBasedInsetTop, 0)
  const safePanX = Math.max(panEvent.x - scrollBasedInsetLeft, 0)

  return {
    config: listConfig,
    cellHeight,
    cellWidth,
    safePanY,
    safePanX,
  }
}

type ListContext = ReturnType<typeof createLayoutContext>

interface ListScrollMeta {
  scrolledPastInset: boolean
  firstFullyVisibleCellStart: number
  firstCellSizeRemainder: number
  isFirstCellCutOff: boolean
}
export function distanceToFirstCell(
  listScroll: number,
  inset: number,
  itemSize: number,
  cellSize: number
): ListScrollMeta {
  "worklet"
  const scrolledPastInset = listScroll >= inset
  const firstFullyVisibleCellStart = scrolledPastInset
    ? cellSize - ((listScroll - inset) % cellSize)
    : 0
  const firstCellSizeRemainder = scrolledPastInset
    ? Math.max(itemSize - ((listScroll - inset) % cellSize), 0)
    : 0
  const isFirstCellCutOff = firstCellSizeRemainder > 0

  return {
    scrolledPastInset,
    firstFullyVisibleCellStart,
    firstCellSizeRemainder,
    isFirstCellCutOff,
  }
}

export function getListColumnRowCount(
  isHorizontal: boolean,
  configRows: number,
  configColumns: number,
  contentLayout: ListLayout,
  ctx: ListContext
) {
  "worklet"
  const windowHeight = contentLayout.height
  const windowWidth = contentLayout.width

  const numRows = isHorizontal
    ? configRows
    : // +1 is to account for a partially visible row/column at the bottom and top of the list
      // we only care that this value is higher than the correct number of rows/columns for now.
      Math.ceil(windowHeight / ctx.cellHeight) + 1

  const numColumns = isHorizontal
    ? Math.ceil(windowWidth / ctx.cellWidth) + 1
    : configColumns

  return {
    numRows,
    numColumns,
  }
}

export function calculateScrolledCells(
  scroll: number,
  inset: number,
  itemSize: number,
  cellSize: number
): number {
  "worklet"
  const normalizedScroll = scroll - inset
  const remainder = normalizedScroll % cellSize
  if (
    remainder === 0 &&
    normalizedScroll >= itemSize &&
    normalizedScroll < cellSize
  ) {
    return 1
  } else if (remainder >= itemSize) {
    return Math.floor(normalizedScroll / cellSize) + 1
  }
  return Math.floor(normalizedScroll / cellSize)
}

export function getBreakpoints(
  length: number,
  pan: number,
  listScrollMeta: ListScrollMeta,
  itemSize: number,
  cellSize: number,
  gap: number
): Array<number> | null {
  "worklet"
  const rects = Array.from({ length }).map((_, index) => {
    let min = listScrollMeta.isFirstCellCutOff
      ? listScrollMeta.firstCellSizeRemainder + gap + (index - 1) * cellSize
      : listScrollMeta.firstFullyVisibleCellStart + index * cellSize
    min = index === 0 && listScrollMeta.isFirstCellCutOff ? 0 : min

    let max = min + cellSize
    max =
      index === 0 && listScrollMeta.isFirstCellCutOff
        ? listScrollMeta.firstCellSizeRemainder
        : max

    const actualSize =
      index === 0 && listScrollMeta.isFirstCellCutOff
        ? listScrollMeta.firstCellSizeRemainder
        : cellSize
    return {
      min,
      max,
      center: min + actualSize / 2,
    }
  })

  const boundingRect = rects.find((rect) => {
    return rect.min <= pan && pan <= rect.max
  })
  if (!boundingRect) return null
  const isReversePan = pan <= boundingRect.center

  let breakpoints = Array.from({ length }).map((_, index) => {
    if (listScrollMeta.scrolledPastInset) {
      const factor = listScrollMeta.isFirstCellCutOff
        ? listScrollMeta.firstCellSizeRemainder
        : listScrollMeta.firstFullyVisibleCellStart + itemSize

      if (isReversePan) {
        return index * cellSize + factor
      } else {
        return index * cellSize + gap + factor
      }
    } else {
      if (isReversePan) {
        return itemSize + index * cellSize
      }
      return (index + 1) * cellSize + listScrollMeta.firstFullyVisibleCellStart
    }
  })
  breakpoints.unshift(
    listScrollMeta.isFirstCellCutOff
      ? 0
      : listScrollMeta.firstFullyVisibleCellStart
  )
  return breakpoints
}
