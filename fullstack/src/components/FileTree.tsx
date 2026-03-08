'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react'
import clsx from 'clsx'

interface FileTreeProps {
  files: string[]
  selected: Set<string>
  onToggle: (path: string) => void
}

interface TreeNode {
  name: string
  path: string
  isFile: boolean
  children: TreeNode[]
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const p of paths) {
    const parts = p.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      const nodePath = parts.slice(0, i + 1).join('/')

      let found = current.find((n) => n.name === name)
      if (!found) {
        found = { name, path: nodePath, isFile, children: [] }
        current.push(found)
      }
      current = found.children
    }
  }

  return root
}

function TreeItem({
  node,
  selected,
  onToggle,
  depth = 0,
}: {
  node: TreeNode
  selected: Set<string>
  onToggle: (path: string) => void
  depth?: number
}) {
  const [open, setOpen] = useState(true)
  const isChecked = selected.has(node.path)

  if (node.isFile) {
    return (
      <label
        className={clsx(
          'flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors duration-150',
          'hover:bg-surface-100',
          isChecked && 'bg-brand-50',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(node.path)}
          className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
        />
        <FileText className="w-4 h-4 text-surface-400 flex-shrink-0" />
        <span className="text-sm text-surface-700 font-mono truncate">{node.name}</span>
      </label>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 py-1.5 px-2 w-full rounded-md hover:bg-surface-100 transition-colors duration-150 cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-surface-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-surface-400" />
        )}
        <Folder className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-surface-600">{node.name}</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ files, selected, onToggle }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files])

  return (
    <div className="border border-surface-200 rounded-lg bg-surface-0 overflow-hidden">
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {tree.map((node) => (
          <TreeItem key={node.path} node={node} selected={selected} onToggle={onToggle} />
        ))}
        {files.length === 0 && (
          <p className="text-sm text-surface-400 text-center py-6">暂无 Markdown 文件</p>
        )}
      </div>
    </div>
  )
}
