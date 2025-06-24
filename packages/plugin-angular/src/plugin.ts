import path from 'node:path'

import { FileManager, type Group, type Plugin, PluginManager, createPlugin } from '@kubb/core'
import { camelCase, pascalCase } from '@kubb/core/transformers'
import { OperationGenerator, pluginOasName, type PluginOas } from '@kubb/plugin-oas'

import { pluginTsName } from '@kubb/plugin-ts'

import type { PluginAngular } from './types.ts'

export const pluginAngularName = 'plugin-angular' satisfies PluginAngular['name']

export const pluginAngular = createPlugin<PluginAngular>((options) => {
  const { output = { path: 'services' }, group, exclude = [], include, override = [], contentType } = options

  return {
    name: pluginAngularName,
    options: {
      output,
      group,
    },
    pre: [pluginOasName, pluginTsName].filter(Boolean),
    resolvePath(baseName, pathMode, options) {
      const root = path.resolve(this.config.root, this.config.output.path)
      const mode = pathMode ?? FileManager.getMode(path.resolve(root, output.path))

      if (mode === 'single') {
        /**
         * when output is a file then we will always append to the same file(output file), see fileManager.addOrAppend
         * Other plugins then need to call addOrAppend instead of just add from the fileManager class
         */
        return path.resolve(root, output.path)
      }

      if (group && (options?.group?.path || options?.group?.tag)) {
        const groupName: Group['name'] = group?.name
          ? group.name
          : (ctx) => {
              if (group?.type === 'path') {
                return `${ctx.group.split('/')[1]}`
              }
              if (group?.type === 'tag') {
                return pascalCase(`${ctx.group}Service`)
              }

              return camelCase(ctx.group)
            }

        return path.resolve(
          root,
          output.path,
          groupName({
            group: group.type === 'path' ? options.group.path! : options.group.tag!,
          }),
          baseName,
        )
      }

      return path.resolve(root, output.path, baseName)
    },
    async buildStart() {
      const [oasPlugin]: [Plugin<PluginOas>] = PluginManager.getDependedPlugins<PluginOas>(this.plugins, [pluginOasName])
      const oas = await oasPlugin.context.getOas()
      const root = path.resolve(this.config.root, this.config.output.path)
      const mode = FileManager.getMode(path.resolve(root, output.path))

      const oasGenerator = new OperationGenerator(this.plugin.options, {
        oas,
        pluginManager: this.pluginManager,
        plugin: this.plugin,
        contentType,
        exclude,
        include,
        override,
        mode,
      })

      const files = await oasGenerator.build()
      await this.addFile(...files)
    },
  }
})
