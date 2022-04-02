import React, { useState } from "react";

import "./Table.less";

function identity(value) {
  return value;
}
export function Table({ columns, intro, rows, ifEmpty, className = "" }) {
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
