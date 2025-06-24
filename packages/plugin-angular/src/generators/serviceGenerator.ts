import { createGenerator } from '@kubb/plugin-oas'

export const serviceGenerator = createGenerator({
  name: 'service',
  operation: async () => {
    return []
  },
})
