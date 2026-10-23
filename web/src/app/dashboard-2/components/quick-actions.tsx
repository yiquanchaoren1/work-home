"use client"

import { Plus, Settings, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function QuickActions() {
  return (
    <div className="flex items-center gap-2">
      <Button className="cursor-pointer">
        <Plus data-icon="inline-start" />
        New Sale
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className="cursor-pointer" />}
        >
          <Settings data-icon="inline-start" />
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer">
              <FileText />
              Generate Report
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Download />
              Export Data
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer">
              <Settings />
              Dashboard Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
