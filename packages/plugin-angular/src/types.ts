import type { Group, Output, PluginFactoryOptions, ResolveNameParams } from '@kubb/core'

import type { contentType, Oas } from '@kubb/oas'
import type { Exclude, Include, Override, ResolvePathOptions } from '@kubb/plugin-oas'

export type Options = {
  /**
   * Specify the export location for the files and define the behavior of the output
   * @default { path: 'services' }
   */
  output?: Output<Oas>
  /**
   * Define which contentType should be used.
   * By default, the first JSON valid mediaType will be used
   */
  contentType?: contentType

  /**
   * Group the services based on the provided name.
   */
  group?: Group
  /**
   * Array containing exclude parameters to exclude/skip tags/operations/methods/paths.
   */
  exclude?: Array<Exclude>
  /**
   * Array containing include parameters to include tags/operations/methods/paths.
   */
  include?: Array<Include>
  /**
   * Array containing override parameters to override options for specific tags/operations/methods/paths.
   */
  override?: Array<Override<ResolvedOptions>>

  transformers?: {
    /**
     * Customize the names of the generated files.
     */
    name?: ResolveNameParams
  }
}

type ResolvedOptions = {
  output: Output<Oas>
}

export type PluginAngular = PluginFactoryOptions<'plugin-angular', Options, ResolvedOptions, never, ResolvePathOptions>
