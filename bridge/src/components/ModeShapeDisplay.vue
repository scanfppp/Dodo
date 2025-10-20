<template>
  <div class="mode-shape-display">
    <div class="control-panel">
      <h3>模态振型动画控制</h3>
      
      <!-- 模态阶数选择 -->
      <div class="control-item">
        <label for="mode-select">选择模态阶数：</label>
        <select id="mode-select" v-model="selectedMode" @change="fetchModeShapeData">
          <option v-for="mode in availableModes" :key="mode.order" :value="mode.order">
            模态 {{ mode.order }} ({{ mode.frequency.toFixed(2) }} Hz)
          </option>
        </select>
      </div>
      
      <!-- 动画控制按钮 -->
      <div class="control-buttons">
        <button 
          class="control-btn" 
          @click="toggleAnimation"
          :class="{ active: isAnimating }"
        >
          {{ isAnimating ? '停止动画' : '播放动画' }}
        </button>
        
        <!-- 速度调节 -->
        <div class="speed-control">
          <label for="speed-slider">动画速度：</label>
          <input 
            id="speed-slider"
            type="range" 
            min="0.1" 
            max="3" 
            step="0.1" 
            v-model.number="animationSpeed"
            @input="updateAnimationSpeed"
          >
          <span class="speed-value">{{ animationSpeed.toFixed(1) }}x</span>
        </div>
        
        <!-- 振幅调节 -->
        <div class="amplitude-control">
          <label for="amplitude-slider">变形振幅：</label>
          <input 
            id="amplitude-slider"
            type="range" 
            min="0.1" 
            max="3" 
            step="0.1" 
            v-model.number="deformationAmplitude"
            @input="updateModeVisualization"
          >
          <span class="amplitude-value">{{ deformationAmplitude.toFixed(1) }}x</span>
        </div>
        
        <!-- 重置视角 -->
        <button class="control-btn" @click="resetView">重置视角</button>
      </div>
    </div>
    
    <!-- 3D渲染容器 -->
    <div class="render-container" ref="renderContainer"></div>
    
    <!-- 数据加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载模态振型数据中...</p>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="fetchModeShapeData">重试</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Tween, Easing } from '@tweenjs/tween.js';
import axios from 'axios';

// 组件引用
const renderContainer = ref(null);

// 状态变量
const selectedMode = ref(1);
const isAnimating = ref(false);
const animationSpeed = ref(1.0);
const deformationAmplitude = ref(1.0);
const isLoading = ref(false);
const error = ref(null);
const availableModes = ref([]);
const modeShapeData = ref(null);

// 3D场景相关
let scene, camera, renderer, controls;
let bridgeModel, deckMesh, originalVertices = [];
let animationFrameId = null;
let currentTime = 0;

// API配置
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * 初始化3D场景
 */
function initScene() {
  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // 创建相机
  camera = new THREE.PerspectiveCamera(
    60,
    renderContainer.value.clientWidth / renderContainer.value.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 80, 150);
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(renderContainer.value.clientWidth, renderContainer.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderContainer.value.appendChild(renderer.domElement);
  
  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 100);
  scene.add(directionalLight);
  
  // 添加辅助网格
  const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xeeeeee);
  scene.add(gridHelper);
  
  // 创建桥梁模型
  createBridgeModel();
  
  // 启动渲染循环
  animate();
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
}

/**
 * 创建三跨连续梁模型
 */
function createBridgeModel() {
  const scale = 1;
  const bridgeGroup = new THREE.Group();
  
  // 创建桥墩
  const pillarGeometry = new THREE.BoxGeometry(3, 15, 3);
  const pillarMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    metalness: 0.3,
    roughness: 0.7
  });
  
  // 左侧桥墩
  const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  leftPillar.position.set(-30, 7.5, 0);
  bridgeGroup.add(leftPillar);
  
  // 右侧桥墩
  const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
  rightPillar.position.set(30, 7.5, 0);
  bridgeGroup.add(rightPillar);
  
  // 已删除中间桥墩
  
  // 创建桥面 - 使用更高精度的几何体以实现更好的变形效果
  const deckGeometry = new THREE.BoxGeometry(90, 1, 4, 30, 1, 2);
  const deckMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4A90E2,
    metalness: 0.8,
    roughness: 0.2,
    side: THREE.DoubleSide
  });
  
  deckMesh = new THREE.Mesh(deckGeometry, deckMaterial);
  deckMesh.position.set(0, 15, 0);
  bridgeGroup.add(deckMesh);
  
  // 保存原始顶点位置，用于变形计算
  saveOriginalVertices();
  
  // 将桥梁模型添加到场景
  scene.add(bridgeGroup);
  bridgeModel = bridgeGroup;
}

/**
 * 保存桥面原始顶点位置
 */
function saveOriginalVertices() {
  if (!deckMesh) return;
  
  const geometry = deckMesh.geometry;
  geometry.computeVertexNormals();
  const positionAttribute = geometry.attributes.position;
  
  // 清空原始顶点数组
  originalVertices = [];
  
  // 保存每个顶点的原始位置
  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    originalVertices.push(new THREE.Vector3(x, y, z));
  }
}

/**
 * 从后端获取模态阶数列表
 */
async function fetchAvailableModes() {
  try {
    const response = await axios.get(`${API_BASE_URL}/modal-analysis`);
    availableModes.value = response.data.modes;
    if (availableModes.value.length > 0) {
      selectedMode.value = availableModes.value[0].order || 1;
    }
  } catch (err) {
    console.error('获取模态列表失败:', err);
    // 使用模拟数据
    availableModes.value = [
      { order: 1, frequency: 2.35 },
      { order: 2, frequency: 5.12 },
      { order: 3, frequency: 8.76 },
      { order: 4, frequency: 12.43 }
    ];
  }
}

/**
 * 从后端获取模态振型数据
 */
async function fetchModeShapeData() {
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await axios.get(`${API_BASE_URL}/mode-shape`, {
      params: { mode: selectedMode.value }
    });
    
    modeShapeData.value = response.data;
    console.log('模态振型数据:', modeShapeData.value);
    
    // 更新可视化
    updateModeVisualization();
    
    // 如果动画正在播放，重新启动动画
    if (isAnimating.value) {
      stopAnimation();
      startAnimation();
    }
  } catch (err) {
    console.error('获取模态振型数据失败:', err);
    error.value = '获取模态振型数据失败，请检查后端服务';
    
    // 使用模拟数据
    generateMockModeShapeData();
  } finally {
    isLoading.value = false;
  }
}

/**
 * 生成模拟的模态振型数据
 */
function generateMockModeShapeData() {
  const mockData = {
    mode: selectedMode.value,
    nodes: []
  };
  
  // 根据模态阶数生成不同的变形模式
  for (let i = 0; i <= 9; i++) {
    const x = -45 + (i * 9);
    let deformation = 0;
    
    switch (selectedMode.value) {
      case 1:
        // 第一阶：中间下弯
        deformation = Math.sin((x + 45) / 90 * Math.PI) * 5;
        break;
      case 2:
        // 第二阶：两端下弯，中间上弯
        deformation = Math.sin((x + 45) / 45 * Math.PI) * 4;
        break;
      case 3:
        // 第三阶：三个波峰波谷
        deformation = Math.sin((x + 45) / 30 * Math.PI) * 3;
        break;
      case 4:
        // 第四阶：四个波峰波谷
        deformation = Math.sin((x + 45) / 22.5 * Math.PI) * 2.5;
        break;
      default:
        deformation = Math.sin((x + 45) / 90 * Math.PI * selectedMode.value) * 2;
    }
    
    mockData.nodes.push({
      position: { x, y: 15, z: 0 },
      deformation: { x: 0, y: -deformation, z: 0 }
    });
  }
  
  modeShapeData.value = mockData;
  updateModeVisualization();
}

/**
 * 更新模态可视化
 */
function updateModeVisualization() {
  if (!modeShapeData.value || !modeShapeData.value.nodes || !deckMesh) return;
  
  // 应用当前变形状态
  applyDeformation(0.5); // 使用中间状态作为静态显示
}

/**
 * 应用变形到桥梁模型
 * @param {number} offset - 当前动画偏移量（0-1）
 */
function applyDeformation(offset) {
  if (!deckMesh || !modeShapeData.value || !modeShapeData.value.nodes) return;
  
  const geometry = deckMesh.geometry;
  const positionAttribute = geometry.attributes.position;
  
  // 遍历每个顶点，应用变形
  for (let i = 0; i < positionAttribute.count; i++) {
    // 获取顶点原始位置
    const originalPos = originalVertices[i];
    
    // 找到最近的变形节点
    const nearestNode = findNearestNode(originalPos);
    
    if (nearestNode) {
      // 计算变形强度（基于到节点的距离）
      const deformationIntensity = calculateDeformationIntensity(originalPos, nearestNode.position);
      
      // 应用变形
      const x = originalPos.x + 
        nearestNode.deformation.x * deformationIntensity * deformationAmplitude.value * (offset - 0.5);
      const y = originalPos.y + 
        nearestNode.deformation.y * deformationIntensity * deformationAmplitude.value * (offset - 0.5);
      const z = originalPos.z + 
        nearestNode.deformation.z * deformationIntensity * deformationAmplitude.value * (offset - 0.5);
      
      positionAttribute.setXYZ(i, x, y, z);
    } else {
      // 如果没有找到最近节点，使用原始位置
      positionAttribute.setXYZ(i, originalPos.x, originalPos.y, originalPos.z);
    }
  }
  
  // 标记几何体需要更新
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * 查找离指定位置最近的节点
 */
function findNearestNode(position) {
  if (!modeShapeData.value || !modeShapeData.value.nodes) return null;
  
  let nearestNode = null;
  let minDistance = Infinity;
  
  modeShapeData.value.nodes.forEach(node => {
    const distance = Math.abs(position.x - node.position.x); // 主要考虑X轴方向的距离
    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = node;
    }
  });
  
  return nearestNode;
}

/**
 * 计算变形强度（基于距离的插值）
 */
function calculateDeformationIntensity(position, nodePosition) {
  const distance = Math.abs(position.x - nodePosition.x);
  const nodeSpacing = 9; // 节点间距
  
  // 使用平滑的插值函数
  if (distance > nodeSpacing) return 0;
  
  // 余弦插值函数，提供更平滑的变形过渡
  const t = distance / nodeSpacing;
  return (1 + Math.cos(Math.PI * t)) / 2;
}

/**
 * 启动动画
 */
function startAnimation() {
  if (!modeShapeData.value || !modeShapeData.value.nodes || !deckMesh) {
    fetchModeShapeData();
    return;
  }
  
  isAnimating.value = true;
  currentTime = 0;
  
  // 创建循环动画
  const animateStep = () => {
    // 使用正弦函数模拟振动
    const offset = Math.sin(currentTime * animationSpeed.value) * 0.5 + 0.5;
    
    // 应用变形到桥梁模型
    applyDeformation(offset);
    
    currentTime += 0.016; // 约60fps
    if (isAnimating.value) {
      animationFrameId = requestAnimationFrame(animateStep);
    }
  };
  
  animateStep();
}

/**
 * 停止动画
 */
function stopAnimation() {
  isAnimating.value = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * 重置桥梁变形
 */
function resetDeformation() {
  if (!deckMesh || originalVertices.length === 0) return;
  
  const geometry = deckMesh.geometry;
  const positionAttribute = geometry.attributes.position;
  
  // 恢复所有顶点到原始位置
  for (let i = 0; i < positionAttribute.count && i < originalVertices.length; i++) {
    const originalPos = originalVertices[i];
    positionAttribute.setXYZ(i, originalPos.x, originalPos.y, originalPos.z);
  }
  
  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * 切换动画状态
 */
function toggleAnimation() {
  if (isAnimating.value) {
    stopAnimation();
  } else {
    startAnimation();
  }
}

/**
 * 更新动画速度
 */
function updateAnimationSpeed() {
  // 动画速度变化会在动画循环中自动应用
  console.log('动画速度更新为:', animationSpeed.value);
}

/**
 * 重置视角
 */
function resetView() {
  camera.position.set(0, 80, 150);
  controls.reset();
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
  if (!renderContainer.value) return;
  
  const width = renderContainer.value.clientWidth;
  const height = renderContainer.value.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
}

/**
 * 主渲染循环
 */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// 生命周期钩子
onMounted(async () => {
  await nextTick();
  initScene();
  await fetchAvailableModes();
  fetchModeShapeData();
});

onUnmounted(() => {
  stopAnimation();
  window.removeEventListener('resize', handleResize);
  if (renderer) {
    renderer.dispose();
  }
});
</script>

<style scoped>
.mode-shape-display {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  position: relative;
}

.control-panel {
  background-color: #f8f9fa;
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-bottom: 10px;
}

.control-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333333;
  font-size: 14px;
  text-align: center;
}

.control-item {
  margin-bottom: 8px;
}

.control-item label {
  display: block;
  margin-bottom: 3px;
  font-weight: bold;
  color: #555555;
  font-size: 12px;
}

.control-item select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #dddddd;
  border-radius: 4px;
  background-color: #ffffff;
  font-size: 12px;
  transition: border-color 0.3s;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background-color: #1976d2;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.control-btn:hover {
  background-color: #1565C0;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.control-btn.active {
  background-color: #f44336;
}

.speed-control,
.amplitude-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.speed-control label,
.amplitude-control label {
  flex: 1;
  font-size: 14px;
  color: #555;
}

.speed-control input,
.amplitude-control input {
  flex: 2;
}

.speed-value,
.amplitude-value {
  min-width: 40px;
  text-align: right;
  font-weight: bold;
  color: #1976D2;
}

.render-container {
  flex: 1;
  position: relative;
  background-color: #ffffff;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  min-height: 400px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #ffebee;
  color: #c62828;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.error-message button {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #c62828;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-message button:hover {
  background-color: #b71c1c;
}
</style>