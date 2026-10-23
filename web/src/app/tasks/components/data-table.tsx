import {useWorkspace} from '@/hub/workspace'
import {Button} from '@/components/ui/button'
"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  flexRender,
  useTable,
} from "@tanstack/react-table"

import { dataTableFeatures, type DataTableFeatures } from "@/lib/data-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"


interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<DataTableFeatures, TData>[]
  data: TData[]

}

export function DataTable<TData extends RowData>({
  columns,
  data,
}: DataTableProps<TData>) {
  const w=useWorkspace()
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useTable({
    features: dataTableFeatures,
    data,
    getRowId: (row) => (row as {id:string}).id,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  })

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar table={table} />
      {table.getSelectedRowModel().rows.length>0&&<div className="flex items-center flex-wrap gap-3 rounded-lg border p-3 bg-muted/40"><span>已选 {table.getSelectedRowModel().rows.length} 项</span>{['待开始','进行中','已完成','资料归档'].map(status=><Button key={status} size="sm" variant="outline" onClick={()=>{const ids=new Set(table.getSelectedRowModel().rows.map(r=>(r.original as {id:string}).id));w.save({...w.current.current,tasks:w.current.current.tasks.map(t=>ids.has(t.id)?{...t,status,updatedAt:new Date().toISOString()}:t)},'批量更新状态');setRowSelection({})}}>设为{status}</Button>)}</div>}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  没有匹配的事项。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
