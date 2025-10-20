<template>
  <div id="app">
    <!-- 顶部标签页导航 - 用于切换不同的功能模块 -->
    <div class="tabs-container">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'monitoring' }"
        @click="activeTab = 'monitoring'"
      >
        桥梁监测
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'mode-shape' }"
        @click="activeTab = 'mode-shape'"
      >
        模态振型动画
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'frequency' }"
        @click="activeTab = 'frequency'"
      >
        频率响应分析
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'combined' }"
        @click="activeTab = 'combined'"
      >
        频率响应与模态振型综合分析
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'stiffness-mass' }"
        @click="activeTab = 'stiffness-mass'"
      >
        刚度质量监测
      </button>
    </div>
    
    <!-- 组件容器 - 根据当前激活的标签显示对应的组件 -->
    <div class="content-container">
      <BridgeVisualizer v-if="activeTab === 'monitoring'" />
      <ModeShapeDisplay v-if="activeTab === 'mode-shape'" />
      <FrequencyDisplay v-if="activeTab === 'frequency'" />
      <CombinedAnalysis v-if="activeTab === 'combined'" />
      <StiffnessMassDisplay v-if="activeTab === 'stiffness-mass'" />
    </div>
  </div>
</template>

<script setup>
// 导入Vue的ref响应式API
import { ref } from 'vue';

// 导入各个功能组件
import BridgeVisualizer from './components/BridgeVisualizer.vue';
import ModeShapeDisplay from './components/ModeShapeDisplay.vue';
import FrequencyDisplay from './components/FrequencyDisplay.vue';
import CombinedAnalysis from './components/CombinedAnalysis.vue';
import StiffnessMassDisplay from './components/StiffnessMassDisplay.vue';

// 活动标签页状态 - 用于控制当前显示的组件
// 默认显示桥梁监测页面
const activeTab = ref('monitoring');
</script>

<style>
/* 全局重置样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 基础样式设置 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f0f2f5;
}

/* 应用根容器样式 */
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 标签页容器样式 */
.tabs-container {
  background-color: #2c3e50;
  display: flex;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 标签按钮基础样式 */
.tab-btn {
  padding: 15px 30px;
  margin: 0 5px;
  border: none;
  background: transparent;
  color: #ecf0f1;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

/* 标签按钮悬停效果 */
.tab-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

/* 激活状态的标签按钮样式 */
.tab-btn.active {
  color: white;
  background-color: rgba(255, 255, 255, 0.15);
  border-bottom: 3px solid #3498db;
}

/* 内容容器样式 */
.content-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding: 20px;
}

/* 确保每个功能组件都能填充整个内容容器 */
.content-container > * {
  width: 100%;
  height: 100%;
}
</style>
