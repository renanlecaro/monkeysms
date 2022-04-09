import "/imports/lib/TableStyle.less";
import React, { useEffect, useState } from "react";

function identity(value) {
  return value;
}

interface TableColumn<T> {
  label: string;
  value?: (row: T) => any;
  render?: (value: any, row: T) => JSX.Element | string;
}

type TableProps<T> = {
  columns: TableColumn<T>[];
  intro?: JSX.Element;
  rows: T[];
  ifEmpty?: JSX.Element;
  className?: string;
};

export function Table<T>({
  columns,
  intro,
  rows,
  ifEmpty,
  className = "",
}: TableProps<T>) {
  if (!rows.length) return ifEmpty || null;
  return (
    <>
      {intro || null}
      <div className={"defaultTableWrapper " + className}>
        <table>
          <thead>
            <tr>
              {columns.map(({ label }, columnIndex) => (
                <th key={columnIndex}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(
                  ({ value = identity, render = identity }, columnIndex) => (
                    <td key={columnIndex}>{render(value(row), row)}</td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
