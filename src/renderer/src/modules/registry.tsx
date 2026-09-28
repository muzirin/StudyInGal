import type { SvgIconComponent } from '@mui/icons-material'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded'
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import CloudRoundedIcon from '@mui/icons-material/CloudRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'

export type ModuleGroup = '学习' | '工具' | '资源' | '系统'

export interface ModuleDef {
  id: string
  label: string
  path: string
  icon: SvgIconComponent
  group: ModuleGroup
  description: string
  pinnedByDefault?: boolean
  devOnly?: boolean
  feature?: string
}

export const MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    label: '总览',
    path: '/',
    icon: DashboardRoundedIcon,
    group: '学习',
    description: '今日课程、待办、学习进度与伴学娘问候',
    pinnedByDefault: true,
    feature: '学习仪表盘'
  },
  {
    id: 'library-paper',
    label: '论文库',
    path: '/library/paper',
    icon: ScienceRoundedIcon,
    group: '学习',
    description: '托管 LaTeX / Markdown / PDF / Doc，支持标签、文件夹、系列与云盘',
    pinnedByDefault: true,
    feature: '论文库托管'
  },
  {
    id: 'library-textbook',
    label: '教材库',
    path: '/library/textbook',
    icon: MenuBookRoundedIcon,
    group: '学习',
    description: '多格式教材托管、目录自动合并、本地优先 OCR、分册生成 Gal',
    feature: '教材库托管'
  },
  {
    id: 'companion',
    label: '伴学娘',
    path: '/companion',
    icon: ForumRoundedIcon,
    group: '学习',
    description: '角色对话、Live2D 立绘、主动搭话与语音合成',
    pinnedByDefault: true,
    feature: '伴学娘对话系统'
  },
  {
    id: 'galgame',
    label: 'Gal 工坊',
    path: '/galgame',
    icon: AutoStoriesRoundedIcon,
    group: '学习',
    description: '把论文/教材转换为 Galgame 剧本并游玩',
    feature: '论文/教材转 Galgame'
  },
  {
    id: 'archive',
    label: '存档管理',
    path: '/archive',
    icon: SaveRoundedIcon,
    group: '学习',
    description: '本地/云盘存档、标签、收藏与进度',
    feature: '存档管理'
  },
  {
    id: 'tools',
    label: '学习工具',
    path: '/tools',
    icon: ConstructionRoundedIcon,
    group: '工具',
    description: '日程、课表、番茄钟、白噪音、高数计算器',
    feature: '学习小工具'
  },
  {
    id: 'xuexitong',
    label: '学习通托管',
    path: '/xuexitong',
    icon: SchoolRoundedIcon,
    group: '工具',
    description: '接入 Fanxing 子系统，完成非编程作业',
    feature: '学习通托管'
  },
  {
    id: 'playground',
    label: '代码练习场',
    path: '/playground',
    icon: TerminalRoundedIcon,
    group: '工具',
    description: '自动检测 gcc/g++/msvc/python/csharp/java/js 环境，可选安装',
    feature: '代码 playground'
  },
  {
    id: 'characters',
    label: '角色管理',
    path: '/characters',
    icon: SmartToyRoundedIcon,
    group: '资源',
    description: '多角色、立绘、Live2D、语音与设定导入导出',
    feature: '多角色管理'
  },
  {
    id: 'workshop',
    label: '创意工坊',
    path: '/workshop',
    icon: StorefrontRoundedIcon,
    group: '资源',
    description: '打包/校验/安装资源包，支持自部署 CDN 与一键导出配置',
    feature: '创意工坊'
  },
  {
    id: 'cloud',
    label: '云盘与同步',
    path: '/cloud',
    icon: CloudRoundedIcon,
    group: '资源',
    description: '挂载 SMB / WebDAV / 夸克网盘，多端同步',
    feature: '云盘与多端同步'
  },
  {
    id: 'settings',
    label: '设置',
    path: '/settings',
    icon: SettingsRoundedIcon,
    group: '系统',
    description: '主题、API 提供商、编辑器、开发者选项',
    feature: '设置中心'
  },
  {
    id: 'devtools',
    label: '开发者模式',
    path: '/devtools',
    icon: BugReportRoundedIcon,
    group: '系统',
    description: '内嵌 CLI 终端、错误采集与一键 issue 汇报',
    devOnly: true,
    feature: '开发者模式'
  }
]

export const moduleById = (id: string): ModuleDef | undefined => MODULES.find((item) => item.id === id)

export const GROUP_ORDER: ModuleGroup[] = ['学习', '工具', '资源', '系统']

export function pathToModuleId(pathname: string): string {
  if (pathname.startsWith('/library/')) return `library-${pathname.split('/')[2] ?? 'paper'}`
  const direct = MODULES.find((item) => item.path === pathname && item.path !== '/')
  if (direct) return direct.id
  if (pathname.startsWith('/reader')) return 'library-paper'
  if (pathname.startsWith('/editor')) return 'library-paper'
  return 'dashboard'
}
