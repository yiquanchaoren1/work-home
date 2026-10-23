"use client"

import type { Row, RowData } from "@tanstack/react-table"
import type { DataTableFeatures } from "@/lib/data-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { taskSchema } from "../data/schema"

interface DataTableRowActionsProps<TData extends RowData> {
  row: Row<DataTableFeatures, TData>
}

export function DataTableRowActions<TData extends RowData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const task = taskSchema.parse(row.original)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="flex size-8 p-0 data-popup-open:bg-muted cursor-pointer"
          />
        }
      >
        <MoreHorizontal data-icon="inline-start" />
        <span className="sr-only">Open menu for {task.id}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer">
            View Task
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            Edit Task
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer">
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            Mark as Favorite
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" variant="destructive">
            Delete
            <DropdownMenuShortcut className="text-destructive">
              ⌘⌫
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
