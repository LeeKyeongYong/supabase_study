import * as Tooltip from '@radix-ui/react-tooltip'
import clsx from 'clsx'
import saveAs from 'file-saver'
import Link from 'next/link'
import Papa from 'papaparse'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconCopy,
  IconDownload,
  IconEdit,
  IconLock,
  IconTrash,
} from 'ui'

import { parseSupaTable } from 'components/grid'
import { ENTITY_TYPE } from 'data/entity-types/entity-type-constants'
import { Entity } from 'data/entity-types/entity-type-query'
import { fetchAllTableRows } from 'data/table-rows/table-rows-query'
import { getTable } from 'data/tables/table-query'
import { useStore } from 'hooks'
import { useTableEditorStateSnapshot } from 'state/table-editor'
import { useProjectContext } from '../ProjectLayout/ProjectContext'
import { IS_PLATFORM } from 'common'
import { Eye, MoreHorizontal, Table2, Unlock } from 'lucide-react'

export interface EntityListItemProps {
  id: number
  projectRef: string
  item: Entity
  isLocked: boolean
  rlsEnabled: boolean
}

const EntityListItem = ({ id, projectRef, item: entity, isLocked }: EntityListItemProps) => {
  const { ui } = useStore()
  const { project } = useProjectContext()
  const snap = useTableEditorStateSnapshot()
  entity
  const isActive = Number(id) === entity.id

  const formatTooltipText = (entityType: string) => {
    return Object.entries(ENTITY_TYPE)
      .find(([, value]) => value === entityType)?.[0]
      ?.toLowerCase()
      ?.split('_')
      ?.join(' ')
  }

  const exportTableAsCSV = async () => {
    if (IS_PLATFORM && !project?.connectionString)
      return console.error('Connection string is required')
    const toastId = ui.setNotification({
      category: 'loading',
      message: `Exporting ${entity.name} as CSV...`,
    })

    try {
      const table = await getTable({
        id: entity.id,
        projectRef,
        connectionString: project?.connectionString,
      })
      const supaTable =
        table &&
        parseSupaTable(
          {
            table: table,
            columns: table.columns ?? [],
            primaryKeys: table.primary_keys,
            relationships: table.relationships,
          },
          []
        )

      const rows = await fetchAllTableRows({
        projectRef,
        connectionString: project?.connectionString,
        table: supaTable,
      })
      const formattedRows = rows.map((row) => {
        const formattedRow = row
        Object.keys(row).map((column) => {
          if (typeof row[column] === 'object' && row[column] !== null)
            formattedRow[column] = JSON.stringify(formattedRow[column])
        })
        return formattedRow
      })

      if (formattedRows.length > 0) {
        const csv = Papa.unparse(formattedRows, {
          columns: supaTable.columns.map((column) => column.name),
        })
        const csvData = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        saveAs(csvData, `${entity!.name}_rows.csv`)
      }

      ui.setNotification({
        id: toastId,
        category: 'success',
        message: `Successfully exported ${entity.name} as CSV`,
      })
    } catch (error: any) {
      ui.setNotification({
        id: toastId,
        category: 'error',
        message: `Failed to export table: ${error.message}`,
      })
    }
  }

  return (
    <div
      className={clsx(
        'group flex items-center justify-between rounded-md',
        isActive && 'text-foreground bg-surface-200'
      )}
    >
      <Link
        href={`/project/${projectRef}/editor/${entity.id}`}
        className="flex items-center gap-2 py-1 pl-3 w-full max-w-[90%]"
      >
        <Tooltip.Root delayDuration={0} disableHoverableContent={true}>
          <Tooltip.Trigger className="flex items-center">
            {entity.type === ENTITY_TYPE.TABLE ? (
              <Table2 size={15} strokeWidth={1.5} className="text-foreground-light" />
            ) : entity.type === ENTITY_TYPE.VIEW ? (
              <Eye size={15} strokeWidth={1.5} className="text-foreground-light" />
            ) : (
              <div
                className={clsx(
                  'flex items-center justify-center text-xs h-4 w-4 rounded-[2px] font-bold',
                  entity.type === ENTITY_TYPE.FOREIGN_TABLE && 'text-yellow-900 bg-yellow-500',
                  entity.type === ENTITY_TYPE.MATERIALIZED_VIEW && 'text-purple-1000 bg-purple-500',
                  entity.type === ENTITY_TYPE.PARTITIONED_TABLE &&
                    'text-foreground-light bg-border-stronger'
                )}
              >
                {Object.entries(ENTITY_TYPE)
                  .find(([, value]) => value === entity.type)?.[0]?.[0]
                  ?.toUpperCase()}
              </div>
            )}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="bottom">
              <Tooltip.Arrow className="radix-tooltip-arrow" />
              <div
                className={[
                  'rounded bg-alternative py-1 px-2 leading-none shadow',
                  'border border-background',
                ].join(' ')}
              >
                <span className="text-xs text-foreground capitalize">
                  {formatTooltipText(entity.type)}
                </span>
              </div>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <div className="text-sm text-foreground-light group-hover:text-foreground transition max-w-[175px] overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-between gap-2 relative w-full">
          {/* only show tooltips if required, to reduce noise */}
          {entity.name.length > 20 ? (
            <Tooltip.Root delayDuration={0} disableHoverableContent={true}>
              <Tooltip.Trigger className="max-w-[95%] overflow-hidden text-ellipsis whitespace-nowrap">
                {entity.name}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content side="right">
                  <Tooltip.Arrow className="radix-tooltip-arrow" />
                  <div
                    className={[
                      'rounded bg-alternative py-1 px-2 leading-none shadow',
                      'border border-background',
                    ].join(' ')}
                  >
                    <span className="text-xs text-foreground">{entity.name}</span>
                  </div>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            entity.name
          )}

          {entity.type === ENTITY_TYPE.TABLE && entity.rls_enabled && (
            <div className="w-4 px-0.5">
              <Unlock size={14} className="text-orange-700" />
            </div>
          )}
        </div>
      </Link>
      <div className="pr-2 flex items-center">
        {entity.type === ENTITY_TYPE.TABLE && isActive && !isLocked && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="text-foreground-lighter transition-all hover:text-foreground">
                <MoreHorizontal size={14} strokeWidth={2} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start">
              <DropdownMenuItem
                key="edit-table"
                className="space-x-2"
                onClick={(e) => {
                  e.stopPropagation()
                  snap.onEditTable()
                }}
              >
                <IconEdit size="tiny" />
                <p>Edit Table</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                key="duplicate-table"
                className="space-x-2"
                onClick={(e) => {
                  e.stopPropagation()
                  snap.onDuplicateTable()
                }}
              >
                <IconCopy size="tiny" />
                <p>Duplicate Table</p>
              </DropdownMenuItem>
              <DropdownMenuItem key="delete-table" className="space-x-2" asChild>
                <Link
                  key="view-policies"
                  href={`/project/${projectRef}/auth/policies?search=${entity.id}`}
                >
                  <IconLock size="tiny" />
                  <p>View Policies</p>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                key="download-table-csv"
                className="space-x-2"
                onClick={(e) => {
                  e.stopPropagation()
                  exportTableAsCSV()
                }}
              >
                <IconDownload size="tiny" />
                <p>Export as CSV</p>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                key="delete-table"
                className="space-x-2"
                onClick={(e) => {
                  e.stopPropagation()
                  snap.onDeleteTable()
                }}
              >
                <IconTrash size="tiny" />
                <p>Delete Table</p>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

export default EntityListItem
