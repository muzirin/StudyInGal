import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Collapse from '@mui/material/Collapse'
import LabelRoundedIcon from '@mui/icons-material/LabelRounded'
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState } from '../components/Section'
import { formatBytes, formatDate } from '../lib/format'
import type { LibraryKind, LibraryNode, LibrarySnapshot } from '@shared/types'

type MetaKind = 'folder' | 'series' | 'category' | 'tag'
type SortKey = 'recent' | 'title' | 'size' | 'progress'

const SORT_LABEL: Record<SortKey, string> = {
  recent: '最近打开',
  title: '标题',
  size: '体积',
  progress: '阅读进度'
}

export function LibraryPage() {
  const theme = useTheme()
  const params = useParams<{ kind: string }>()
  const kind: LibraryKind = params.kind === 'textbook' ? 'textbook' : 'paper'
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const openAsk = useAppStore((state) => state.openAsk)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [folderFilter, setFolderFilter] = useState<string | null>(null)
  const [seriesFilter, setSeriesFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [openSections, setOpenSections] = useState<Record<MetaKind | 'collection', boolean>>({
    collection: true,
    folder: true,
    series: false,
    category: false,
    tag: false
  })

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuNode, setMenuNode] = useState<LibraryNode | null>(null)
  const [metaDialog, setMetaDialog] = useState<MetaKind | null>(null)
  const [metaName, setMetaName] = useState('')
  const [detailNode, setDetailNode] = useState<LibraryNode | null>(null)
  const [detailDraft, setDetailDraft] = useState<Partial<LibraryNode>>({})
  const [detailTag, setDetailTag] = useState('')
  const [ocrView, setOcrView] = useState<{ title: string; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSnapshot(await api.library.snapshot(kind))
    } catch (error) {
      toast('error', `读取${kind === 'paper' ? '论文' : '教材'}库失败：${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [kind, toast])

  useEffect(() => {
    void load()
    setTagFilter(null)
    setFolderFilter(null)
    setSeriesFilter(null)
    setCategoryFilter(null)
    setFavoriteOnly(false)
  }, [load])

  const nodes = useMemo(() => {
    if (!snapshot) return []
    const keyword = query.trim().toLowerCase()
    const filtered = snapshot.nodes
      .filter((node) => (favoriteOnly ? node.favorite : true))
      .filter((node) => (tagFilter ? node.tags.includes(tagFilter) : true))
      .filter((node) => (folderFilter ? node.folderId === folderFilter : true))
      .filter((node) => (seriesFilter ? node.seriesId === seriesFilter : true))
      .filter((node) => (categoryFilter ? node.categoryId === categoryFilter : true))
      .filter((node) =>
        keyword
          ? node.title.toLowerCase().includes(keyword) ||
            node.abstract.toLowerCase().includes(keyword) ||
            node.authors.join(' ').toLowerCase().includes(keyword)
          : true
      )
    switch (sort) {
      case 'title':
        return filtered.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
      case 'size':
        return filtered.sort((a, b) => b.sizeBytes - a.sizeBytes)
      case 'progress':
        return filtered.sort((a, b) => b.readingProgress - a.readingProgress)
      default:
        return filtered.sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt))
    }
  }, [snapshot, query, tagFilter, folderFilter, seriesFilter, categoryFilter, favoriteOnly, sort])

  const activeFilters = [
    folderFilter ? { label: snapshot?.folders.find((item) => item.id === folderFilter)?.name ?? '文件夹', clear: () => setFolderFilter(null) } : null,
    seriesFilter ? { label: snapshot?.series.find((item) => item.id === seriesFilter)?.name ?? '系列', clear: () => setSeriesFilter(null) } : null,
    categoryFilter ? { label: snapshot?.categories.find((item) => item.id === categoryFilter)?.name ?? '分类', clear: () => setCategoryFilter(null) } : null,
    tagFilter ? { label: `#${tagFilter}`, clear: () => setTagFilter(null) } : null,
    favoriteOnly ? { label: '只看收藏', clear: () => setFavoriteOnly(false) } : null
  ].filter(Boolean) as { label: string; clear: () => void }[]

  const clearFilters = (): void => {
    setFolderFilter(null)
    setSeriesFilter(null)
    setCategoryFilter(null)
    setTagFilter(null)
    setFavoriteOnly(false)
  }

  const importFiles = async (): Promise<void> => {
    const paths = await api.dialogs.pickFiles({ multi: true })
    if (paths.length === 0) return
    const created = await api.library.import({
      kind,
      paths,
      folderId: folderFilter,
      seriesId: seriesFilter,
      categoryId: categoryFilter,
      tags: tagFilter ? [tagFilter] : []
    })
    toast(created.length > 0 ? 'success' : 'warning', `导入 ${created.length} 个文献`)
    await load()
  }

  const importFolder = async (): Promise<void> => {
    const directory = await api.dialogs.pickDirectory()
    if (!directory) return
    const created = await api.library.import({
      kind,
      paths: [directory],
      folderId: folderFilter,
      seriesId: seriesFilter,
      categoryId: categoryFilter,
      tags: tagFilter ? [tagFilter] : []
    })
    toast(created.length > 0 ? 'success' : 'warning', created.length > 0 ? '已作为分册教材导入' : '导入失败')
    await load()
  }

  const createMeta = async (): Promise<void> => {
    const name = metaName.trim()
    if (!name || !metaDialog) return
    if (metaDialog === 'folder') await api.library.createFolder({ kind, name, parentId: null })
    else if (metaDialog === 'series') await api.library.createSeries({ kind, name })
    else if (metaDialog === 'category') await api.library.createCategory({ kind, name })
    else await api.library.createTag({ name })
    setMetaDialog(null)
    setMetaName('')
    await load()
  }

  const removeMeta = async (meta: MetaKind, id: string): Promise<void> => {
    await api.library.removeMeta({ kind, meta, id })
    if (meta === 'folder' && folderFilter === id) setFolderFilter(null)
    if (meta === 'series' && seriesFilter === id) setSeriesFilter(null)
    if (meta === 'category' && categoryFilter === id) setCategoryFilter(null)
    await load()
  }

  const openDetail = (node: LibraryNode): void => {
    setDetailNode(node)
    setDetailDraft({
      title: node.title,
      authors: node.authors,
      abstract: node.abstract,
      tags: [...node.tags],
      folderId: node.folderId,
      seriesId: node.seriesId,
      categoryId: node.categoryId,
      favorite: node.favorite
    })
    setDetailTag('')
  }

  const saveDetail = async (): Promise<void> => {
    if (!detailNode) return
    await api.library.update(kind, detailNode.id, detailDraft)
    setDetailNode(null)
    await load()
    toast('success', '已保存文献信息')
  }

  const toggleFavorite = async (node: LibraryNode): Promise<void> => {
    await api.library.update(kind, node.id, { favorite: !node.favorite })
    await load()
  }

  const removeNode = async (node: LibraryNode): Promise<void> => {
    await api.library.remove(kind, node.id)
    toast('info', `已从库中移除：${node.title}`)
    await load()
  }

  const runOcr = async (node: LibraryNode): Promise<void> => {
    toast('info', `开始 OCR：${node.title}`)
    try {
      const result = await api.library.ocr(node.id, useAppStore.getState().settings?.library.ocrLanguage ?? 'chi_sim+eng')
      toast('success', `OCR 完成，共 ${result.text.length} 字符`)
      await load()
    } catch (error) {
      toast('error', `OCR 失败：${(error as Error).message}`)
    }
  }

  const KindIcon = kind === 'paper' ? ScienceRoundedIcon : MenuBookRoundedIcon
  const total = snapshot?.nodes.length ?? 0

  const filterGroup = (
    key: MetaKind,
    label: string,
    icon: React.ReactNode,
    items: { id: string; name: string; value?: string }[],
    activeId: string | null,
    onSelect: (id: string | null) => void
  ) => {
    const isOpen = openSections[key]
    return (
      <Box key={key}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ px: 1, py: 0.5, cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}
          onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}
        >
          <ExpandMoreRoundedIcon
            sx={{ fontSize: 16, color: 'text.disabled', transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease' }}
          />
          <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 16 } }}>{icon}</Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ flexGrow: 1 }}>
            {label}
          </Typography>
          <Chip size="small" variant="outlined" label={items.length} sx={{ height: 17, fontSize: 10 }} />
          <Tooltip title={`新建${label}`}>
            <IconButton
              size="small"
              sx={{ p: 0.25 }}
              onClick={(event) => {
                event.stopPropagation()
                setMetaDialog(key)
              }}
            >
              <AddRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Collapse in={isOpen} timeout={180} unmountOnExit>
          <Stack spacing={0.25} sx={{ pl: 1.5, ml: 1.5, borderLeft: '1px solid', borderColor: 'divider', py: 0.5 }}>
            {items.length === 0 ? (
              <Typography variant="caption" color="text.disabled" sx={{ px: 1, py: 0.5 }}>
                暂无
              </Typography>
            ) : (
              items.map((item) => {
                const selectValue = item.value ?? item.id
                const active = activeId === selectValue
                return (
                  <Stack
                    key={item.id}
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    onClick={() => onSelect(active ? null : selectValue)}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), '& .meta-del': { opacity: 1 } }
                    }}
                  >
                    <Typography variant="body2" noWrap sx={{ flexGrow: 1, fontWeight: active ? 700 : 400 }} title={item.name}>
                      {item.name}
                    </Typography>
                    <IconButton
                      className="meta-del"
                      size="small"
                      sx={{ p: 0.25, opacity: 0, transition: 'opacity 140ms ease' }}
                      onClick={(event) => {
                        event.stopPropagation()
                        void removeMeta(key, item.id)
                      }}
                    >
                      <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Stack>
                )
              })
            )}
          </Stack>
        </Collapse>
      </Box>
    )
  }

  const rail = (
    <Stack
      spacing={0.5}
      sx={{
        p: 1.25,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.7),
        position: { lg: 'sticky' },
        top: { lg: 8 },
        maxHeight: { lg: 'calc(100vh - 120px)' },
        overflowY: 'auto'
      }}
      className="sig-scroll-thin"
    >
      <Stack direction="row" alignItems="center" sx={{ px: 1, pb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ flexGrow: 1 }}>
          筛选
        </Typography>
        {activeFilters.length > 0 ? (
          <Tooltip title="清除全部筛选">
            <IconButton size="small" onClick={clearFilters}>
              <ClearAllRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>

      <Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ px: 1, py: 0.5, cursor: 'pointer', borderRadius: 2 }}
          onClick={() => setOpenSections((prev) => ({ ...prev, collection: !prev.collection }))}
        >
          <ExpandMoreRoundedIcon
            sx={{ fontSize: 16, color: 'text.disabled', transform: openSections.collection ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease' }}
          />
          <CollectionsBookmarkRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ flexGrow: 1 }}>
            收藏与状态
          </Typography>
        </Stack>
        <Collapse in={openSections.collection} timeout={180} unmountOnExit>
          <Stack sx={{ pl: 3.5, py: 0.5 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={favoriteOnly} onChange={(event) => setFavoriteOnly(event.target.checked)} />}
              label={<Typography variant="body2">只看收藏</Typography>}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={sort === 'progress'} onChange={(event) => setSort(event.target.checked ? 'progress' : 'recent')} />}
              label={<Typography variant="body2">按阅读进度排序</Typography>}
            />
          </Stack>
        </Collapse>
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {filterGroup('folder', '文件夹', <FolderRoundedIcon />, snapshot?.folders ?? [], folderFilter, setFolderFilter)}
      {filterGroup('series', '系列', <CollectionsBookmarkRoundedIcon />, snapshot?.series ?? [], seriesFilter, setSeriesFilter)}
      {filterGroup('category', '分类', <CategoryRoundedIcon />, snapshot?.categories ?? [], categoryFilter, setCategoryFilter)}
      {filterGroup('tag', '标签', <LabelRoundedIcon />, (snapshot?.tags ?? []).map((tag) => ({ id: tag.id, name: `#${tag.name}`, value: tag.name })), tagFilter, setTagFilter)}
    </Stack>
  )

  return (
    <Stack spacing={2.5}>
      <Card elevation={0}>
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <KindIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>
                  {kind === 'paper' ? '论文库' : '教材库'}
                </Typography>
                <Chip size="small" label={`${total} 项`} />
                {nodes.length !== total ? <Chip size="small" variant="outlined" color="primary" label={`筛选后 ${nodes.length}`} /> : null}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                支持 LaTeX / Markdown / PDF / Doc / Docx；文件夹教材以只读方式自动合并展示，不改动原始文件。
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="small" startIcon={<CreateNewFolderRoundedIcon />} onClick={() => setMetaDialog('folder')}>
                新建文件夹
              </Button>
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setMetaDialog('tag')}>
                新建标签
              </Button>
              <Button size="small" variant="outlined" startIcon={<FolderRoundedIcon />} onClick={() => void importFolder()}>
                导入文件夹
              </Button>
              <Button size="small" variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => void importFiles()}>
                导入文件
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="搜索标题、作者、摘要"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ flexGrow: 1, minWidth: 220 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 999 }
              }}
            />
            <TextField select size="small" label="排序" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} sx={{ width: 150 }}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <MenuItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </MenuItem>
              ))}
            </TextField>
            {compact ? (
              <Button size="small" variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setFiltersOpen((value) => !value)}>
                筛选{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
              </Button>
            ) : null}
            <ToggleButtonGroup size="small" exclusive value={layout} onChange={(_event, value) => value && setLayout(value)}>
              <ToggleButton value="grid">
                <GridViewRoundedIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list">
                <ViewListRoundedIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {activeFilters.length > 0 ? (
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" color="text.secondary">
                当前筛选：
              </Typography>
              {activeFilters.map((filter) => (
                <Chip key={filter.label} size="small" label={filter.label} onDelete={filter.clear} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Card>

      {loading ? <LinearProgress /> : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '248px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        {(!compact || filtersOpen) && rail}

        <Box sx={{ minWidth: 0 }}>
          {total === 0 && !loading ? (
            <Card elevation={0}>
              <EmptyState
                icon={<KindIcon sx={{ fontSize: 44 }} />}
                title={`${kind === 'paper' ? '论文库' : '教材库'}还是空的`}
                description="导入单个文件，或导入包含分章节 Markdown / LaTeX 的文件夹。所有库内操作都是索引式管理，移除条目不会删除磁盘文件。"
                action={
                  <Stack direction="row" spacing={1.5}>
                    <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => void importFiles()}>
                      导入文件
                    </Button>
                    <Button variant="outlined" startIcon={<FolderRoundedIcon />} onClick={() => void importFolder()}>
                      导入文件夹
                    </Button>
                  </Stack>
                }
              />
            </Card>
          ) : nodes.length === 0 ? (
            <Card elevation={0}>
              <EmptyState
                title="没有匹配的文献"
                description="试试清除筛选条件，或更换关键词。"
                action={
                  <Button variant="outlined" onClick={clearFilters} startIcon={<ClearAllRoundedIcon />}>
                    清除筛选
                  </Button>
                }
              />
            </Card>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1.75,
                gridTemplateColumns:
                  layout === 'grid' ? { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } : '1fr'
              }}
            >
              {nodes.map((node) => (
                <Card key={node.id} elevation={0} sx={{ position: 'relative', overflow: 'hidden' }}>
                  <CardActionArea onClick={() => navigate(`/reader/${kind}/${node.id}`)} sx={{ p: 2, pr: 7 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                        {node.format === 'folder' ? <FolderRoundedIcon /> : <KindIcon />}
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap title={node.title}>
                          {node.title}
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          <Chip size="small" label={node.format.toUpperCase()} />
                          {node.format === 'folder' ? <Chip size="small" label={`${node.chapters.length} 章`} /> : null}
                          {node.ocrStatus === 'done' ? <Chip size="small" color="success" label="OCR" /> : null}
                          {node.seriesId ? <Chip size="small" variant="outlined" label={snapshot?.series.find((item) => item.id === node.seriesId)?.name ?? '系列'} /> : null}
                          {node.tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} size="small" variant="outlined" label={`#${tag}`} />
                          ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                          {formatBytes(node.sizeBytes)} · 更新于 {formatDate(node.updatedAt)}
                          {node.lastOpenedAt ? ` · 上次打开 ${formatDate(node.lastOpenedAt)}` : ''}
                        </Typography>
                        {node.readingProgress > 0 ? (
                          <Tooltip title={`阅读进度 ${Math.round(node.readingProgress * 100)}%`}>
                            <LinearProgress variant="determinate" value={node.readingProgress * 100} sx={{ mt: 1, borderRadius: 999 }} />
                          </Tooltip>
                        ) : null}
                      </Box>
                    </Stack>
                  </CardActionArea>
                  <Stack direction="row" sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <IconButton size="small" onClick={() => void toggleFavorite(node)}>
                      {node.favorite ? <StarRoundedIcon fontSize="small" color="warning" /> : <StarBorderRoundedIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        setMenuNode(node)
                        setMenuAnchor(event.currentTarget)
                      }}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            navigate(`/reader/${kind}/${menuNode?.id}`)
            setMenuAnchor(null)
          }}
        >
          <AutoStoriesRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 阅读 / 合并视图
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/editor/${kind}/${menuNode?.id}`)
            setMenuAnchor(null)
          }}
        >
          <EditRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 编辑源码
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) openDetail(menuNode)
            setMenuAnchor(null)
          }}
        >
          <TuneRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 信息与归类
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) openAsk({ sourceId: menuNode.id, title: menuNode.title })
            setMenuAnchor(null)
          }}
        >
          <FactCheckRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 一键询问
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) void runOcr(menuNode)
            setMenuAnchor(null)
          }}
        >
          <FactCheckRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 本地 OCR
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (!menuNode) return
            const result = await api.library.ocrText(menuNode.id)
            setMenuAnchor(null)
            if (!result.exists) {
              toast('info', '该文献还没有 OCR 结果，可先执行「本地 OCR」')
              return
            }
            setOcrView({ title: menuNode.title, text: result.text })
          }}
        >
          <FactCheckRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 查看 OCR 文本
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) void api.app.revealPath(menuNode.path)
            setMenuAnchor(null)
          }}
        >
          <FolderOpenRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 在文件管理器中显示
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) void removeNode(menuNode)
            setMenuAnchor(null)
          }}
        >
          <DeleteRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 从库中移除
        </MenuItem>
      </Menu>

      <Dialog open={metaDialog !== null} onClose={() => setMetaDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {metaDialog === 'folder' ? '新建文件夹' : metaDialog === 'series' ? '新建系列' : metaDialog === 'category' ? '新建分类' : '新建标签'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="名称"
            value={metaName}
            onChange={(event) => setMetaName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void createMeta()
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetaDialog(null)}>取消</Button>
          <Button variant="contained" onClick={() => void createMeta()}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailNode !== null} onClose={() => setDetailNode(null)} fullWidth maxWidth="sm">
        <DialogTitle>文献信息与归类</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="标题" value={detailDraft.title ?? ''} onChange={(event) => setDetailDraft({ ...detailDraft, title: event.target.value })} fullWidth />
            <TextField
              label="作者（用逗号分隔）"
              value={(detailDraft.authors ?? []).join(', ')}
              onChange={(event) =>
                setDetailDraft({
                  ...detailDraft,
                  authors: event.target.value
                    .split(/[,，]/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                })
              }
              fullWidth
            />
            <TextField
              label="摘要 / 备注"
              value={detailDraft.abstract ?? ''}
              onChange={(event) => setDetailDraft({ ...detailDraft, abstract: event.target.value })}
              multiline
              minRows={3}
              fullWidth
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <TextField
                select
                size="small"
                label="文件夹"
                value={detailDraft.folderId ?? ''}
                onChange={(event) => setDetailDraft({ ...detailDraft, folderId: event.target.value || null })}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">未归类</MenuItem>
                {(snapshot?.folders ?? []).map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="系列"
                value={detailDraft.seriesId ?? ''}
                onChange={(event) => setDetailDraft({ ...detailDraft, seriesId: event.target.value || null })}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">未归类</MenuItem>
                {(snapshot?.series ?? []).map((series) => (
                  <MenuItem key={series.id} value={series.id}>
                    {series.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="分类"
                value={detailDraft.categoryId ?? ''}
                onChange={(event) => setDetailDraft({ ...detailDraft, categoryId: event.target.value || null })}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">未归类</MenuItem>
                {(snapshot?.categories ?? []).map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Divider textAlign="left">标签</Divider>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {(detailDraft.tags ?? []).map((tag) => (
                <Chip
                  key={tag}
                  size="small"
                  label={`#${tag}`}
                  onDelete={() => setDetailDraft({ ...detailDraft, tags: (detailDraft.tags ?? []).filter((item) => item !== tag) })}
                />
              ))}
              <TextField
                size="small"
                placeholder="回车添加标签"
                value={detailTag}
                onChange={(event) => setDetailTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && detailTag.trim()) {
                    const tag = detailTag.trim()
                    if (!(detailDraft.tags ?? []).includes(tag)) {
                      setDetailDraft({ ...detailDraft, tags: [...(detailDraft.tags ?? []), tag] })
                    }
                    setDetailTag('')
                  }
                }}
                sx={{ width: 180 }}
              />
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={detailDraft.favorite ?? false} onChange={(event) => setDetailDraft({ ...detailDraft, favorite: event.target.checked })} />}
              label="加入收藏"
            />
            <ListItemText
              primary="文件路径"
              secondary={detailNode?.path}
              secondaryTypographyProps={{ variant: 'caption', sx: { wordBreak: 'break-all' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailNode(null)}>取消</Button>
          <Button variant="contained" onClick={() => void saveDetail()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ocrView !== null} onClose={() => setOcrView(null)} fullWidth maxWidth="md">
        <DialogTitle>OCR 文本 · {ocrView?.title}</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 13.5, fontFamily: 'JetBrains Mono, Consolas, monospace' }}
          >
            {ocrView?.text || '（空）'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (ocrView) {
                void navigator.clipboard.writeText(ocrView.text)
                toast('success', '已复制到剪贴板')
              }
            }}
          >
            复制
          </Button>
          <Button onClick={() => setOcrView(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Alert severity="info" icon={false}>
        所有库内操作都是「索引式管理」：移除条目不会删除磁盘文件，文件夹教材也不会被改写。
      </Alert>
    </Stack>
  )
}
