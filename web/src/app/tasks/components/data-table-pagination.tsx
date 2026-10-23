"use client"

import type { ReactTable, RowData } from "@tanstack/react-table"
import type { DataTableFeatures } from "@/lib/data-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>
}

export function DataTablePagination<TData extends RowData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between px-2 flex-wrap gap-3">
      <div className="flex-1 text-sm text-muted-foreground hidden lg:block">
        {table.getFilteredSelectedRowModel().rows.length} / {" "}
        {table.getFilteredRowModel().rows.length} 项已选
      </div>
      <div className="flex items-center gap-x-3 gap-y-3 flex-wrap lg:gap-x-8">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">每页</p>
          <Select
            value={`${table.state.pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px] cursor-pointer">
              <SelectValue placeholder={table.state.pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem
                    key={pageSize}
                    value={`${pageSize}`}
                    className="cursor-pointer"
                  >
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex cursor-pointer disabled:cursor-not-allowed"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">第一页</span>
            <ChevronsLeft data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0 cursor-pointer disabled:cursor-not-allowed"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">上一页</span>
            <ChevronLeft data-icon="inline-end" />
          </Button>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            第 {table.state.pagination.pageIndex + 1} / {" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            className="size-8 p-0 cursor-pointer disabled:cursor-not-allowed"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">下一页</span>
            <ChevronRight data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex cursor-pointer disabled:cursor-not-allowed"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">最后一页</span>
            <ChevronsRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  )
}
