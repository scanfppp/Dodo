<template>
  <div class="frequency-display-container">
    <div class="control-panel">
      <h2>频率响应函数 (FRF) 分析</h2>
      <div class="control-group">
        <label for="sensor-select">选择传感器:</label>
        <select id="sensor-select" v-model="selectedSensorId" @change="onSensorChange">
          <option v-for="sensorId in 62" :key="sensorId" :value="sensorId">
            加速度传感器 {{ sensorId }}
          </option>
        </select>
      </div>
      <div class="control-group">
        <label for="chart-type">图表类型:</label>
        <select id="chart-type" v-model="chartType" @change="updateChart">
          <option value="psd">功率谱密度 (PSD)</option>
          <option value="frf">频率响应函数 (FRF)</option>
        </select>
      </div>
      <div class="info-panel">
        <p><strong>当前传感器:</strong> {{ currentSensorName }}</p>
        <p><strong>更新时间:</strong> {{ formatTimestamp(timestamp) }}</p>
        <p><strong>模态频率点数:</strong> {{ modalPeaks.length }}</p>
      </div>
      <button class="refresh-btn" @click="refreshData">刷新数据</button>
      
      <!-- 图表移到工具栏下方 -->
      <div class="chart-container">
        <div class="chart-wrapper">
            <!-- 标题已删除 -->
            <canvas ref="chartCanvas" width="350" height="300"></canvas>
          <!-- 模态频率标记 -->
          <div class="modal-markers" v-if="modalPeaks.length > 0">
            <div class="marker" v-for="(peak, index) in modalPeaks" :key="index">
              {{ peak.frequency.toFixed(3) }}Hz
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import axios from 'axios';

// 响应式数据
const selectedSensorId = ref(1);
const chartType = ref('psd');
const frequencies = ref([]);
const psdValues = ref([]);
const frfValues = ref([]);
const modalPeaks = ref([]);
const currentSensorName = ref('加速度传感器1');
const timestamp = ref(new Date().toISOString());
const chartCanvas = ref(null);

let refreshTimer = null;

// 使用Canvas API手动绘制图表
function drawChart() {
  console.log('[FrequencyDisplay] 开始绘制图表');
  
  if (!chartCanvas.value) {
    console.error('[FrequencyDisplay] Canvas元素未找到!');
    return;
  }
  
  const canvas = chartCanvas.value;
  const ctx = canvas.getContext('2d');
  
  // 设置合适的图表尺寸（缩小尺寸到更合理的大小）
  const width = 350; // 固定宽度
    const height = 300; // 固定高度
  
  canvas.width = width;
  canvas.height = height;
  
  console.log(`[FrequencyDisplay] 画布尺寸设置为: ${width}x${height}`);
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 设置图表区域 - 调整边距以适应新尺寸
    const margin = { top: 25, right: 20, bottom: 40, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  
  // 绘制坐标轴和标签
  drawAxes(ctx, width, height, margin);
  
  // 绘制网格线
  drawGrid(ctx, width, height, margin, plotWidth, plotHeight);
  
  // 选择要使用的数据
  const valuesToUse = chartType.value === 'psd' ? psdValues.value : frfValues.value;
  const dataPoints = frequencies.value.length > 0 ? frequencies.value.length : 0;
  
  console.log(`[FrequencyDisplay] 使用${chartType.value.toUpperCase()}数据，共${dataPoints}个数据点`);
  
  // 绘制频率响应曲线
  if (frequencies.value.length > 0 && valuesToUse.length > 0) {
    drawFrequencyCurve(ctx, frequencies.value, valuesToUse, margin, plotWidth, plotHeight, width, height);
    
    // 绘制模态峰值点
    if (modalPeaks.value.length > 0) {
      drawModalPeaks(ctx, frequencies.value, valuesToUse, modalPeaks.value, margin, plotWidth, plotHeight, width, height);
    }
  } else {
    // 绘制提示信息
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('等待数据加载...', width / 2, height / 2);
    console.log('[FrequencyDisplay] 没有数据，显示加载提示');
  }
  
  // 绘制当前传感器信息 - 减小字体并调整位置
    ctx.fillStyle = '#333333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`传感器 ${selectedSensorId.value} - ${chartType.value === 'psd' ? '功率谱密度' : '频率响应函数'}`, margin.left, margin.top + 15);
  
  console.log('[FrequencyDisplay] 图表绘制完成');
}

// 绘制坐标轴
function drawAxes(ctx, width, height, margin) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  // X轴
  ctx.beginPath();
  ctx.moveTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  ctx.stroke();
  
  // Y轴
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.stroke();
  
  // X轴标签
  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('频率 (Hz)', width / 2, height - 10);
  
  // Y轴标签
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('幅值', 0, 0);
  ctx.restore();
}

// 绘制网格线
function drawGrid(ctx, width, height, margin, plotWidth, plotHeight) {
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]); // 虚线
  
  // 垂直网格线和刻度
  const numXGridLines = 10;
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  
  const maxFreq = frequencies.value.length > 0 ? Math.max(...frequencies.value) : 100;
  
  for (let i = 0; i <= numXGridLines; i++) {
    const x = margin.left + (i / numXGridLines) * plotWidth;
    const freq = Math.round((i / numXGridLines) * maxFreq);
    
    // 网格线
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, height - margin.bottom);
    ctx.stroke();
    
    // 刻度标签
    ctx.fillText(freq.toString(), x, height - margin.bottom + 20);
  }
  
  // 水平网格线和刻度
  const numYGridLines = 5;
  ctx.textAlign = 'right';
  
  const valuesToUse = chartType.value === 'psd' ? psdValues.value : frfValues.value;
  const maxValue = valuesToUse.length > 0 ? Math.max(...valuesToUse) : 1;
  
  for (let i = 0; i <= numYGridLines; i++) {
    const y = height - margin.bottom - (i / numYGridLines) * plotHeight;
    const amplitude = ((i / numYGridLines) * maxValue).toFixed(1);
    
    // 网格线
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    
    // 刻度标签
    ctx.fillText(amplitude, margin.left - 10, y + 5);
  }
  
  ctx.setLineDash([]); // 恢复实线
}

// 绘制频率响应曲线
function drawFrequencyCurve(ctx, frequencies, values, margin, plotWidth, plotHeight, width, height) {
  const maxValue = Math.max(...values);
  const maxFrequency = Math.max(...frequencies);
  
  ctx.strokeStyle = '#1e88e5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  frequencies.forEach((freq, index) => {
    // 归一化坐标
    const x = margin.left + (freq / maxFrequency) * plotWidth;
    const y = height - margin.bottom - (values[index] / maxValue) * plotHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  console.log(`[FrequencyDisplay] 频率曲线绘制完成，最大值: ${maxValue} at ${maxFrequency} Hz`);
}

// 绘制模态峰值点
function drawModalPeaks(ctx, frequencies, values, peaks, margin, plotWidth, plotHeight, width, height) {
  const maxValue = Math.max(...values);
  const maxFrequency = Math.max(...frequencies);
  
  peaks.forEach((peak, index) => {
    // 找到最接近的频率点
    const closestIndex = frequencies.reduce((prev, curr, idx) => 
      Math.abs(curr - peak.frequency) < Math.abs(frequencies[prev] - peak.frequency) ? idx : prev
    , 0);
    
    const x = margin.left + (frequencies[closestIndex] / maxFrequency) * plotWidth;
    const y = height - margin.bottom - (values[closestIndex] / maxValue) * plotHeight;
    
    // 绘制峰值点
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // 添加模态频率标签 - 减小字体并优化位置
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    
    // 根据位置调整标签显示位置，避免超出画布或重叠
    let labelY = y - 12;
    if (labelY < margin.top + 10) {
      labelY = y + 20;
    }
    
    ctx.fillText(`${peak.frequency.toFixed(2)} Hz`, x, labelY);
    
    console.log(`[FrequencyDisplay] 模态峰值 ${index + 1}: ${peak.frequency.toFixed(3)} Hz at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  });
}

// 更新图表
function updateChart() {
  drawChart();
}

// 获取频率数据
async function fetchFrequencyData(sensorId) {
  try {
    // 模拟API调用，使用mock数据
    console.log(`获取传感器 ${sensorId} 的频率数据...`);
    
    // 生成模拟数据
    generateMockData();
    
    // 使用setTimeout确保DOM更新完成
    setTimeout(() => {
      drawChart();
    }, 10);
  } catch (error) {
    console.error('获取频率数据失败:', error);
  }
}

// 生成模拟数据
function generateMockData() {
  // 生成频率数组 (0-10Hz)// 生成模拟数据
  frequencies.value = Array.from({ length: 1001 }, (_, i) => i * 0.01);
  
  console.log(`Generated frequency data: length=${frequencies.value.length}, min=${frequencies.value[0]}, max=${frequencies.value[frequencies.value.length-1]}`);
  
  // 生成PSD/FRF值
  psdValues.value = [];
  frfValues.value = [];
  
  frequencies.value.forEach(freq => {
    // 基础噪声
    const noise = (Math.random() - 0.5) * 20;
    
    // 生成一些峰值来模拟模态频率
    let peakValue = 0;
    
    // 模拟模态频率峰值
    if (Math.abs(freq - 3.929) < 0.1) {
      peakValue = 100 * Math.exp(-Math.pow((freq - 3.929) / 0.02, 2));
    } else if (Math.abs(freq - 4.034) < 0.1) {
      peakValue = 90 * Math.exp(-Math.pow((freq - 4.034) / 0.02, 2));
    } else if (Math.abs(freq - 5.236) < 0.1) {
      peakValue = 110 * Math.exp(-Math.pow((freq - 5.236) / 0.02, 2));
    } else if (Math.abs(freq - 7.854) < 0.1) {
      peakValue = 85 * Math.exp(-Math.pow((freq - 7.854) / 0.02, 2));
    }
    
    // 计算PSD值
    const psdBase = 50 + Math.sin(freq * 2) * 10;
    psdValues.value.push(psdBase + peakValue + noise);
    
    // 计算FRF值
    const frfBase = 40 + Math.cos(freq * 3) * 8;
    frfValues.value.push(frfBase + peakValue * 0.8 + noise * 0.8);
  });
  
  // 设置模态峰值数据
  modalPeaks.value = [
    { frequency: 3.929, amplitude: 150 },
    { frequency: 4.034, amplitude: 140 },
    { frequency: 5.236, amplitude: 160 },
    { frequency: 7.854, amplitude: 135 }
  ];
  
  currentSensorName.value = `加速度传感器${selectedSensorId.value}`;
  timestamp.value = new Date().toISOString();
}

// 传感器选择变化
function onSensorChange() {
  fetchFrequencyData(selectedSensorId.value);
}

// 手动刷新数据
function refreshData() {
  fetchFrequencyData(selectedSensorId.value);
}

// 格式化时间戳
function formatTimestamp(ts) {
  const date = new Date(ts);
  return date.toLocaleString('zh-CN');
}

// 设置定时刷新
function setupAutoRefresh() {
  // 每10秒刷新一次数据
  refreshTimer = setInterval(() => {
    fetchFrequencyData(selectedSensorId.value);
  }, 10000);
}

// 监听窗口大小变化
function handleResize() {
  if (chartCanvas.value) {
    drawChart();
  }
}

// 组件挂载
onMounted(async () => {
  await nextTick();
  // 确保DOM完全渲染后再初始化
  setTimeout(() => {
    console.log('Mounted, initializing chart...', chartCanvas.value);
    fetchFrequencyData(selectedSensorId.value);
  }, 100);
  setupAutoRefresh();
  window.addEventListener('resize', handleResize);
});

// 组件卸载
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.frequency-display-container {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
}

.control-panel {
  width: 100%;
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.chart-container {
  margin-top: 5px;
  padding: 5px;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart-wrapper {
  padding: 5px 0;
  background-color: transparent;
  width: 100%;
  display: block;
  text-align: center;
}

.chart-wrapper canvas {
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.refresh-btn {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 10px;
  box-sizing: border-box;
}

.refresh-btn:hover {
  background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 136, 229, 0.4);
}

.refresh-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(30, 136, 229, 0.3);
}

.refresh-btn:disabled {
  background: #bdbdbd;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>