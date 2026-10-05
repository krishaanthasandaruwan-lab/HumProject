/** A roving cell focus keeps large musical grids usable without thousands of Tab stops. */
export function gridKeyboard(grid: HTMLElement): void {
  const focusCell = (cell: HTMLElement): void => {
    grid.querySelector<HTMLElement>('.cell[tabindex="0"]')?.setAttribute('tabindex', '-1');
    cell.tabIndex = 0;
  };
  grid.addEventListener('focusin', (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cell');
    if (cell) focusCell(cell);
  });
  grid.addEventListener('keydown', (event) => {
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const cell = (event.target as HTMLElement).closest<HTMLElement>('.cell');
    if (!move || !cell) return;
    event.preventDefault();
    const next = grid.querySelector<HTMLElement>(`.cell[data-step="${Number(cell.dataset.step) + move[0]}"][data-row="${Number(cell.dataset.row) + move[1]}"]`);
    if (next) { focusCell(next); next.focus(); }
  });
}
