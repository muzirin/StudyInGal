import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material'
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
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatBytes, formatDate } from '../lib/format'
import type { LibraryKind, LibraryNode, LibrarySnapshot } from '@shared/types'

export function LibraryPage() {
  const params = useParams<{ kind: string }>()
  const kind: LibraryKind = params.kind === 'textbook' ? 'textbook' : 'paper'
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const openAsk = useAppStore((state) => state.openAsk)

  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [folderFilter, setFolderFilter] = useState<string | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuNode, setMenuNode] = useState<LibraryNode | null>(null)
  const [metaDialog, setMetaDialog] = useState<null | 'folder' | 'tag'>(null)
  const [metaName, setMetaName] = useState('')

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
    setFavoriteOnly(false)
  }, [load])

  const importFiles = async (): Promise<void> => {
    const paths = await api.dialogs.pickFiles({ multi: true })
    if (paths.length === 0) return
    const created = await api.library.import({ kind, paths })
    toast(created.length > 0 ? 'success' : 'warning', `导入 ${created.length} 个文献`)
    await load()
  }

  const importFolder = async (): Promise<void> => {
    const directory = await api.dialogs.pickDirectory()
    if (!directory) return
    const created = await api.library.import({ kind, paths: [directory] })
    toast(created.length > 0 ? 'success' : 'warning', created.length > 0 ? '已作为分册教材导入' : '导入失败')
    await load()
  }

  const nodes = useMemo(() => {
    if (!snapshot) return []
    const keyword = query.trim().toLowerCase()
    return snapshot.nodes
      .filter((node) => (favoriteOnly ? node.favorite : true))
      .filter((node) => (tagFilter ? node.tags.includes(tagFilter) : true))
      .filter((node) => (folderFilter ? node.folderId === folderFilter : true))
      .filter((node) =>
        keyword
          ? node.title.toLowerCase().includes(keyword) ||
            node.abstract.toLowerCase().includes(keyword) ||
            node.authors.join(' ').toLowerCase().includes(keyword)
          : true
      )
      .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt))
  }, [snapshot, query, tagFilter, folderFilter, favoriteOnly])

  const toggleFavorite = async (node: LibraryNode): Promise<void> => {
    await api.library.update(kind, node.id, { favorite: !node.favorite })
    await load()
  }

  const remove = async (node: LibraryNode): Promise<void> => {
    await api.library.remove(kind, node.id)
    toast('info', `已从库中移除：${node.title}`)
    await load()
  }

  const runOcr = async (node: LibraryNode): Promise<string | undefined> => {
    toast('info', `开始 OCR：${node.title}（本地 Tesseract，首次运行需联网下载语言包）`)
    try {
      const result = await api.library.ocr(node.id, useAppStore.getState().settings?.library.ocrLanguage ?? 'chi_sim+eng')
      toast('success', `OCR 完成，共 ${result.text.length} 字符`)
      await load()
      return result.text
    } catch (error) {
      toast('error', `OCR 失败：${(error as Error).message}`)
    }
  }

  const createMeta = async (): Promise<void> => {
    if (!metaName.trim() || !metaDialog) return
    if (metaDialog === 'folder') await api.library.createFolder({ kind, name: metaName.trim(), parentId: null })
    else await api.library.createTag({ name: metaName.trim() })
    setMetaDialog(null)
    setMetaName('')
    await load()
  }

  const KindIcon = kind === 'paper' ? ScienceRoundedIcon : MenuBookRoundedIcon

  return (
    <Stack spacing={2.5}>
      <Section
        title={`${kind === 'paper' ? '论文库' : '教材库'} · ${snapshot?.nodes.length ?? 0} 项`}
        subtitle="支持 LaTeX / Markdown / PDF / Doc / Docx，文件夹分册教材可自动合并展示"
        action={
          <Stack direction="row" spacing={1}>
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
        }
        disablePadding
      >
        <Box sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索标题、作者、摘要"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              select
              size="small"
              label="标签"
              value={tagFilter ?? ''}
              onChange={(event) => setTagFilter(event.target.value || null)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">全部</MenuItem>
              {(snapshot?.tags ?? []).map((tag) => (
                <MenuItem key={tag.id} value={tag.name}>
                  #{tag.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="文件夹"
              value={folderFilter ?? ''}
              onChange={(event) => setFolderFilter(event.target.value || null)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">全部</MenuItem>
              {(snapshot?.folders ?? []).map((folder) => (
                <MenuItem key={folder.id} value={folder.id}>
                  {folder.name}
                </MenuItem>
              ))}
            </TextField>
            <ToggleButton size="small" value="favorite" selected={favoriteOnly} onChange={() => setFavoriteOnly((value) => !value)}>
              <StarRoundedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButtonGroup size="small" exclusive value={layout} onChange={(_event, value) => value && setLayout(value)}>
              <ToggleButton value="grid">卡片</ToggleButton>
              <ToggleButton value="list">列表</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>
      </Section>

      {loading ? <LinearProgress /> : null}

      {nodes.length === 0 && !loading ? (
        <Section title="还没有内容">
          <EmptyState
            icon={<KindIcon fontSize="inherit" />}
            title={`${kind === 'paper' ? '论文库' : '教材库'}是空的`}
            description="导入单个文件，或导入包含分章节 Markdown / LaTeX 的文件夹，StudyInGal 会以只读方式自动合并展示，不修改原始文件。"
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
        </Section>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns:
              layout === 'grid' ? { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' } : '1fr'
          }}
        >
          {nodes.map((node) => (
            <Card key={node.id} elevation={0} sx={{ position: 'relative' }}>
              <CardActionArea onClick={() => navigate(`/reader/${node.id}`)} sx={{ p: 2, pr: 6 }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ color: 'primary.main' }}>
                    {node.format === 'folder' ? <FolderRoundedIcon /> : <KindIcon />}
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap title={node.title}>
                      {node.title}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      <Chip size="small" label={node.format.toUpperCase()} />
                      {node.format === 'folder' ? <Chip size="small" label={`${node.chapters.length} 章`} /> : null}
                      {node.ocrStatus === 'done' ? <Chip size="small" color="success" label="OCR" /> : null}
                      {node.tags.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="small" variant="outlined" label={`#${tag}`} />
                      ))}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.8 }}>
                      {formatBytes(node.sizeBytes)} · 更新于 {formatDate(node.updatedAt)}
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

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            navigate(`/reader/${menuNode?.id}`)
            setMenuAnchor(null)
          }}
        >
          <AutoStoriesRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 阅读 / 合并视图
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/editor/${menuNode?.id}`)
            setMenuAnchor(null)
          }}
        >
          <EditRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 编辑源码
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
          onClick={() => {
            if (menuNode) void api.app.revealPath(menuNode.path)
            setMenuAnchor(null)
          }}
        >
          <FolderOpenRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 在文件管理器中显示
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNode) void remove(menuNode)
            setMenuAnchor(null)
          }}
        >
          <DeleteRoundedIcon fontSize="small" style={{ marginRight: 12 }} /> 从库中移除
        </MenuItem>
      </Menu>

      <Dialog open={metaDialog !== null} onClose={() => setMetaDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>{metaDialog === 'folder' ? '新建文件夹' : '新建标签'}</DialogTitle>
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

      <Alert severity="info" icon={false}>
        所有库内操作都是「索引式管理」：移除条目不会删除磁盘文件，文件夹教材也不会被改写。
      </Alert>
    </Stack>
  )
}
