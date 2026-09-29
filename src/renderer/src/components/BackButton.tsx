import { IconButton, Tooltip } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { useLocation, useNavigate } from 'react-router-dom'
import { fallbackPath } from '../lib/navigation'

/** 二级页面顶部的返回按钮：优先回退历史，没有历史就回到所属的一级页面 */
export function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Tooltip title="返回">
      <IconButton
        className="no-drag"
        size="small"
        aria-label="返回上一页"
        onClick={() => {
          const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
          if (index > 0) navigate(-1)
          else navigate(fallbackPath(location.pathname))
        }}
      >
        <ArrowBackRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
