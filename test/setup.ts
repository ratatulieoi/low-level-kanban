import { parse, stringify } from 'yaml'
import { setYamlCodec } from '@low-level-kanban/core'
import { setPlatform } from '@low-level-kanban/ui'
import { domPlatform } from '@low-level-kanban/ui/dom-platform'
import '@low-level-kanban/ui/dom-shim'

setYamlCodec({ parse, stringify })
if (typeof document !== 'undefined') setPlatform(domPlatform)
