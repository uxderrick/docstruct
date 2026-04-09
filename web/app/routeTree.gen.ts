import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'

const routeTree = rootRoute.addChildren([indexRoute])

export { routeTree }
