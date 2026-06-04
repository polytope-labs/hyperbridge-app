import { createConsola, LogLevels } from "consola"
import { APP_LOG_LEVEL } from "@/config/constants"

export const logger = createConsola({
  level: LogLevels[APP_LOG_LEVEL],
  formatOptions: {
    columns: 80,
    colors: true,
    compact: true,
    date: false,
  },
})
