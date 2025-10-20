import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// 创建Vue应用实例并挂载到DOM
const app = createApp(App)

// 将应用挂载到ID为'app'的DOM元素上
app.mount('#app')
