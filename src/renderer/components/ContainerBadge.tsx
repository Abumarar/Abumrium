import React from 'react'
import type { ContainerId } from '../../shared/types'
import { CONTAINERS } from '../../shared/constants'

interface Props {
  containerId: ContainerId
  size?: 'sm' | 'md'
}

export const ContainerBadge: React.FC<Props> = ({ containerId, size = 'sm' }) => {
  const container = CONTAINERS.find(c => c.id === containerId) ?? CONTAINERS[0]
  const dim = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'
  return (
    <span
      className={`inline-flex items-center rounded font-semibold uppercase ${dim}`}
      style={{ background: `${container.color}30`, color: container.color, border: `1px solid ${container.color}50` }}
    >
      {container.name}
    </span>
  )
}
