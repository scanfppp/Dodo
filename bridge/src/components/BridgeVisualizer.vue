<template>
  <div class="bridge-monitoring-container">
    <!-- 3D 可视化区域 - 桥梁模型渲染容器 -->
    <!-- 容器通过ref引用获取DOM元素，用于Three.js场景渲染 -->
    <div ref="container" class="bridge-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

/**
 * 桥梁可视化组件 - 使用Three.js实现3D桥梁模型展示与监测
 */

// 3D场景相关引用和变量
const container = ref(null) // 渲染容器引用
const stiffnessCanvas = ref(null) // 刚度变化图表画布引用
let scene, camera, renderer, controls, bridgeGroup // 核心3D对象
// 移除桥梁点击功能，不再需要selectedPart变量
// 射线检测器，用于鼠标交互
let raycaster = new THREE.Raycaster()
// 存储当前悬停的测点球体
let hoveredSensor = null
// 数据刷新定时器
let dataRefreshInterval = null

// 显示标签状态
const showLabels = ref(false) // 是否显示应力标签
const stressLabels = ref([]) // 应力标签元素集合

// 标签页控制
const activeTab = ref('monitoring') // 当前活动标签页：'monitoring' 或 'analysis'

// 模态分析相关状态
const selectedMode = ref(1) // 当前选中的模态阶数
const isAnimating = ref(false) // 是否正在播放模态动画
const showModeDeformation = ref(true) // 是否显示模态变形
let modalAnimationId = null // 模态动画ID
let modeAmplitude = 0 // 模态振动幅度
let modePhase = 0 // 模态振动相位
let modeDeformationObjects = [] // 存储模态变形可视化对象

// 后端API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * 桥梁监测数据对象
 * @property {string} status - 桥梁整体状态: normal, warning, danger
 * @property {number} temperature - 桥梁当前温度
 * @property {number} vibration - 桥梁振动值
 * @property {Array} stressPoints - 应力监测点数据数组
 */
const bridgeData = ref({
  status: 'normal',
  temperature: 25,
  vibration: 0.1,
  stressPoints: [
    // 左侧支座区域 - 5个测点
    { position: { x: -45, y: 5, z: 10 }, value: 0.52, name: '测点1' },
    { position: { x: -45, y: 10, z: 0 }, value: 0.53, name: '测点2' },
    { position: { x: -45, y: 5, z: -10 }, value: 0.51, name: '测点3' },
    { position: { x: -40, y: 7.5, z: 5 }, value: 0.54, name: '测点4' },
    { position: { x: -40, y: 7.5, z: -5 }, value: 0.52, name: '测点5' },
    
    // 左侧桥跨 - 7个测点
    { position: { x: -35, y: 30, z: 10 }, value: 0.65, name: '测点6' },
    { position: { x: -35, y: 30, z: 0 }, value: 0.64, name: '测点7' },
    { position: { x: -35, y: 30, z: -10 }, value: 0.66, name: '测点8' },
    { position: { x: -25, y: 30, z: 10 }, value: 0.61, name: '测点9' },
    { position: { x: -25, y: 30, z: 0 }, value: 0.60, name: '测点10' },
    { position: { x: -25, y: 30, z: -10 }, value: 0.62, name: '测点11' },
    { position: { x: -15, y: 30, z: 0 }, value: 0.58, name: '测点12' },
    
    // 中间区域 - 6个测点
    { position: { x: -10, y: 30, z: 10 }, value: 0.57, name: '测点13' },
    { position: { x: -10, y: 30, z: 0 }, value: 0.58, name: '测点14' },
    { position: { x: -10, y: 30, z: -10 }, value: 0.56, name: '测点15' },
    { position: { x: 10, y: 30, z: 10 }, value: 0.59, name: '测点16' },
    { position: { x: 10, y: 30, z: 0 }, value: 0.58, name: '测点17' },
    { position: { x: 10, y: 30, z: -10 }, value: 0.60, name: '测点18' },
    
    // 右侧桥跨 - 7个测点
    { position: { x: 15, y: 30, z: 0 }, value: 0.59, name: '测点19' },
    { position: { x: 25, y: 30, z: 10 }, value: 0.62, name: '测点20' },
    { position: { x: 25, y: 30, z: 0 }, value: 0.61, name: '测点21' },
    { position: { x: 25, y: 30, z: -10 }, value: 0.63, name: '测点22' },
    { position: { x: 35, y: 30, z: 10 }, value: 0.64, name: '测点23' },
    { position: { x: 35, y: 30, z: 0 }, value: 0.63, name: '测点24' },
    { position: { x: 35, y: 30, z: -10 }, value: 0.65, name: '测点25' },
    
    // 右侧支座区域 - 5个测点
    { position: { x: 45, y: 5, z: 10 }, value: 0.53, name: '测点26' },
    { position: { x: 45, y: 10, z: 0 }, value: 0.54, name: '测点27' },
    { position: { x: 45, y: 5, z: -10 }, value: 0.52, name: '测点28' },
    { position: { x: 40, y: 7.5, z: 5 }, value: 0.55, name: '测点29' },
    { position: { x: 40, y: 7.5, z: -5 }, value: 0.53, name: '测点30' }
  ]
})

// 模态分析数据 - 存储桥梁模态分析相关的所有数据
const modalData = ref({
  modes: [], // 模态列表，包含频率、阻尼比等信息
  stiffnessData: [], // 各分区刚度与质量数据
  modeDeformationPatterns: [] // 各模态的变形模式数组
})

/**
 * 从后端API获取模态分析数据
 * @returns {Promise<boolean>} - 返回数据获取是否成功
 * @description 异步从后端API请求模态分析数据，包括模态频率、阻尼比、变形模式和刚度数据
 *              如果API请求失败，将回退到使用默认模态数据
 */
async function fetchModalData() {
  try {
    const response = await fetch(`${API_BASE_URL}/modal-analysis`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // 更新模态数据
    modalData.value.modes = data.modes.map(mode => ({
      ...mode,
      deformationPoints: [] // 初始化变形点数组
    }));
    
    // 提取变形模式
    modalData.value.modeDeformationPatterns = data.modes.map(mode => mode.deformationPatterns);
    
    // 更新刚度数据
    modalData.value.stiffnessData = data.stiffnessData;
    
    console.log('模态分析数据获取成功');
    return true;
  } catch (error) {
    console.error('获取模态分析数据失败:', error);
    // 使用默认数据作为后备
    useDefaultModalData();
    return false;
  }
}

/**
 * 使用默认模态数据作为后备
 * @description 当后端API无法获取模态数据时，使用预设的默认数据
 *              确保即使在离线或API故障情况下，系统仍能展示模态分析功能
 *              设置了6阶模态的频率、阻尼比、置信度以及对应的变形模式和刚度数据
 */
function useDefaultModalData() {
  modalData.value.modes = [
    { frequency: 2.35, damping: 0.52, confidence: 0.985, deformationPoints: [] },
    { frequency: 5.12, damping: 0.48, confidence: 0.978, deformationPoints: [] },
    { frequency: 8.76, damping: 0.45, confidence: 0.962, deformationPoints: [] },
    { frequency: 12.43, damping: 0.42, confidence: 0.941, deformationPoints: [] },
    { frequency: 16.89, damping: 0.38, confidence: 0.927, deformationPoints: [] },
    { frequency: 21.34, damping: 0.35, confidence: 0.912, deformationPoints: [] }
  ];
  
  modalData.value.modeDeformationPatterns = [
    [0.1, 0.3, 0.5, 0.3, 0.1],
    [0.2, 0.5, 0.8, 0.5, 0.2],
    [0.3, 0.6, 0.9, 0.6, 0.3],
    [0.4, 0.7, 1.0, 0.7, 0.4],
    [0.5, 0.8, 1.1, 0.8, 0.5],
    [0.6, 0.9, 1.2, 0.9, 0.6]
  ];
  
  modalData.value.stiffnessData = [
    { section: '左侧支座', stiffness: 98.5, mass: 102.3 },
    { section: '左侧桥跨', stiffness: 92.1, mass: 95.6 },
    { section: '中间跨', stiffness: 94.8, mass: 97.2 },
    { section: '右侧桥跨', stiffness: 91.5, mass: 96.8 },
    { section: '右侧支座', stiffness: 97.3, mass: 101.5 }
  ];
}

// 后端连接状态
const connectionStatus = ref('disconnected');
let connectionCheckInterval = null;

// 监听数据变化并更新3D模型
watch(bridgeData, (newData) => {
  updateBridgeVisualization(newData)
}, { deep: true })

// 监听标签页切换
watch(activeTab, async (newTab) => {
  if (newTab === 'analysis') {
    await nextTick();
    try {
      // 切换到分析标签时，初始化模态分析相关数据和视图
      await initModalData();
      updateModeVisualization();
      drawStiffnessChart();
      // 显示30个传感器测点
      visualizeStressPoints();
    } catch (error) {
      console.error('初始化模态分析数据失败:', error);
    }
  } else {
    // 切换回监测标签时，清理模态分析对象
    clearModeDeformationObjects();
    // 清理测点显示
    if (scene.stressPoints) {
      scene.stressPoints.forEach(point => scene.remove(point));
      scene.stressPoints = [];
    }
    stressLabels.value.forEach(label => {
      if (label.element?.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    stressLabels.value = [];
  }
});

// 监听选中的模态变化
watch(selectedMode, () => {
  if (activeTab.value === 'analysis') {
    updateModeVisualization();
  }
});

/**
 * 初始化模态分析数据
 * @description 为每个模态生成变形点数据，是模态可视化的核心准备函数
 *              首先尝试从后端获取模态数据，如果失败则使用默认数据
 *              然后为每个模态生成沿桥梁均匀分布的变形点，用于3D可视化展示模态变形
 * @async
 */
async function initModalData() {
  // 先从后端获取模态数据，如果失败则使用默认数据
  await fetchModalData();
  
  // 创建默认的变形点数据用于模态分析
  modalData.value.modes.forEach((mode, index) => {
    const pattern = modalData.value.modeDeformationPatterns[index] || [0.5]; // 提供默认值以防止错误
    
    // 生成默认的变形点（如果没有应力点数据）
    const defaultPoints = [];
    const scale = 20;
    
    // 生成沿桥梁均匀分布的点，用于模态变形可视化
    for (let i = 0; i < 10; i++) {
      const x = -45 + (i * 9); // 沿桥梁均匀分布
      const y = 30; // 桥面高度
      const z = 0; // 中心位置
      
      // 计算该点在模态中的变形幅度
      const sectionIndex = Math.min(Math.floor(i / 2), pattern.length - 1);
      const deformationFactor = pattern[sectionIndex];
      
      defaultPoints.push({
        position: { x, y, z },
        deformation: {
          x: 0,
          y: deformationFactor * 5, // Y方向变形
          z: deformationFactor * 2  // Z方向变形
        },
        name: `变形点${i + 1}`
      });
    }
    
    mode.deformationPoints = defaultPoints;
  });
}

/**
 * 初始化Three.js场景
 * @description 场景初始化的核心函数，创建3D可视化所需的所有基础组件
 *              包括场景对象、相机、渲染器、光源系统、控制器等
 *              构建了完整的照明系统，包括环境光、主方向光、补光和强调光
 *              优化了阴影质量，确保模型显示效果逼真
 */
function initScene() {
  // 创建场景对象 - 3D世界的容器，包含所有可见的3D元素
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0) // 设置浅灰色背景，提供舒适的视觉体验
  
  // 配置光源系统 - 构建多层次照明，确保模型清晰可见且立体感强
  // 1. 环境光 - 提供全局基础照明，消除完全黑暗的区域
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7) // 0.7的强度提供足够的基础亮度
  scene.add(ambientLight)
  
  // 2. 主方向光 - 模拟阳光，从左上方照射，提供主要照明和阴影
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5) // 较高强度确保主要物体明亮
  mainLight.position.set(-80, 120, 60) // 左上方45度角位置，提供良好的立体感
  mainLight.castShadow = true // 启用阴影投射，增强真实感
  // 优化阴影质量 - 提高阴影分辨率和覆盖范围
  mainLight.shadow.mapSize.width = 2048 // 较高的分辨率确保阴影清晰
  mainLight.shadow.mapSize.height = 2048
  mainLight.shadow.camera.top = 150 // 扩大阴影相机范围，确保整个桥梁都在阴影范围内
  mainLight.shadow.camera.bottom = -150
  mainLight.shadow.camera.left = -150
  mainLight.shadow.camera.right = 150
  scene.add(mainLight)
  
  // 3. 辅助方向光 - 从右侧补光，减少主光源造成的强烈阴影
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8) // 中等强度，平衡光照
  fillLight.position.set(100, 80, -60) // 右侧位置，与主光源形成对比
  scene.add(fillLight)
  
  // 4. 底部强调光 - 照亮桥梁底部细节，防止底部过暗
  const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5) // 较低强度，仅作为补充
  bottomLight.position.set(0, -50, 0) // 底部位置，向上照射
  scene.add(bottomLight)
  
  // 5. 添加几个点光源来突出桥梁关键部位
  // 左侧支座点光源
  const leftPointLight = new THREE.PointLight(0xffffff, 0.5, 150)
  leftPointLight.position.set(-30, 15, 0)
  scene.add(leftPointLight)
  
  // 右侧支座点光源
  const rightPointLight = new THREE.PointLight(0xffffff, 0.5, 150)
  rightPointLight.position.set(30, 15, 0)
  scene.add(rightPointLight)
  
  // 中央桥面点光源
  const centerPointLight = new THREE.PointLight(0xffffff, 0.7, 200)
  centerPointLight.position.set(0, 20, 0)
  scene.add(centerPointLight)
  
  // 设置相机
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000) // fov, aspect, near, far
  camera.position.set(100, 80, 120) // 初始视角
  camera.lookAt(0, 0, 0) // 看向原点
  
  // 配置渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true }) // 启用抗锯齿
  const containerRect = container.value.getBoundingClientRect()
  renderer.setSize(containerRect.width, containerRect.height)
  camera.aspect = containerRect.width / containerRect.height
  camera.updateProjectionMatrix()
  container.value.appendChild(renderer.domElement)
  
  // 配置轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // 启用阻尼效果
  controls.dampingFactor = 0.05 // 阻尼系数
  controls.zoomSpeed = 0.8 // 缩放速度
  controls.rotateSpeed = 0.5 // 旋转速度
  controls.target.set(0, 0, 0) // 控制器目标点
  
  // 添加鼠标移动事件监听器
  if (renderer && renderer.domElement) {
    renderer.domElement.addEventListener('mousemove', onMouseMove);
  }
  
  // 创建地面，降低位置使框架底部显露出来
  const groundGeometry = new THREE.BoxGeometry(300, 1, 300)
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.position.y = -5 // 将地面位置降低，使框架底部显露出来
  scene.add(ground)
  
  // 移除网格辅助线，只保留桥梁模型
  // const gridHelper = new THREE.GridHelper(300, 30)
  // scene.add(gridHelper)
  
  // 创建桥梁模型
  createBridge()
  
  // 添加坐标轴辅助（已注释以隐藏）
  // const axesHelper = new THREE.AxesHelper(50)
  // scene.add(axesHelper)
  
  // 添加事件监听器
  window.addEventListener('resize', onWindowResize) // 窗口大小变化
  // 移除桥梁点击功能，不再需要onBridgeClick事件监听器
  
  // 初始化模态数据
  initModalData();
}

/**
 * 创建桥梁模型
 * 构建包含支座和桥面的完整桥梁结构
 */
/**
 * 创建桥梁模型
 * @description 构建完整的桥梁3D模型，包括左右梯形框架支架、中间支撑柱和桥面
 *              将所有组件组织到bridgeGroup中，便于统一管理和操作
 *              是桥梁可视化的核心构建函数
 */
function createBridge() {
  bridgeGroup = new THREE.Group() // 创建桥梁总组
  
  // 定义统一的缩放比例
  const scale = 20;
  
  // 材质系统 - 预定义所有需要的材质
  const materials = {
    // 红色金属材质（用于支柱、支座等结构件）
    redMetal: new THREE.MeshStandardMaterial({
      color: 0xFF0000,  // 红色
      metalness: 0.8,  // 高金属度
      roughness: 0.2
    }),
    // 绿色线框材质（用于梯形框架支架）
    greenWireframe: new THREE.LineBasicMaterial({
      color: 0x00FF00,  // 绿色
      linewidth: 2
    }),
    // 紫色底座材质
    purpleBase: new THREE.MeshStandardMaterial({
      color: 0x9C27B0,  // 紫色
      metalness: 0.8,
      roughness: 0.3
    })
  };

function simulateStressChange() {
  // 为每个应力点添加随机变化
  bridgeData.value.stressPoints.forEach(point => {
    point.value = Math.max(0.1, Math.min(0.9, point.value + (Math.random() - 0.5) * 0.2));
  });
  
  // 根据平均应力值更新整体状态
  const avg = bridgeData.value.stressPoints.reduce((sum, point) => sum + point.value, 0) / 
              bridgeData.value.stressPoints.length;
  bridgeData.value.status = avg > 0.7 ? 'danger' : avg > 0.5 ? 'warning' : 'normal';
}  /**
 * 创建梯形框架支架
 * @param {number} positionX - 支架X轴位置
 * @param {boolean} isLeft - 是否为左侧支架
 * @returns {THREE.Group} 梯形框架支架组件
 */
  const createTrapezoidalFrame = (positionX, isLeft) => {
    const frameGroup = new THREE.Group();
    const scale = 20;
    
    // 计算桥面底部高度 - 确保框架顶部完全贴着桥底面
    const bridgeHeight = 0.05 * scale + 1 * scale;
    
    // 桥面宽度（与实际桥面完全匹配）
    const bridgeWidth = 0.44 * scale;
    
    // 调整支架位置，使其紧密贴合桥梁
    const inwardOffset = (isLeft ? 1 : -1) * 0.05 * scale;
    const adjustedPositionX = positionX + inwardOffset;
    
    // 创建梯形框架结构（使用线段）
    const vertices = [
      // 底部四边形
      adjustedPositionX, 0, bridgeWidth / 2,
      adjustedPositionX, 0, -bridgeWidth / 2,
      adjustedPositionX, 0, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, bridgeWidth / 2,
      adjustedPositionX, 0, bridgeWidth / 2,
      
      // 顶部四边形
      adjustedPositionX, bridgeHeight, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, bridgeWidth / 2,
      
      // 连接上下四边形的主要斜线
      adjustedPositionX, 0, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, bridgeWidth / 2,
      adjustedPositionX, 0, -bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, bridgeWidth / 2,
      
      // 横向支撑梁
      adjustedPositionX, bridgeHeight / 2, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.25 * scale, bridgeHeight / 2, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight / 2, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.25 * scale, bridgeHeight / 2, -bridgeWidth / 2,
      
      // Z轴方向的横向支撑
      adjustedPositionX, bridgeHeight / 2, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight / 2, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.25 * scale, bridgeHeight / 2, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.25 * scale, bridgeHeight / 2, -bridgeWidth / 2,
      
      // 交叉支撑梁1
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, -bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, bridgeWidth / 2,
      
      // 交叉支撑梁2
      adjustedPositionX - (isLeft ? 1 : -1) * 0.4 * scale, 0, bridgeWidth / 2,
      adjustedPositionX, bridgeHeight, -bridgeWidth / 2,
      
      // 额外的垂直支撑
      adjustedPositionX - (isLeft ? 1 : -1) * 0.2 * scale, 0, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.2 * scale, 0, -bridgeWidth / 2,
      adjustedPositionX - (isLeft ? 1 : -1) * 0.1 * scale, bridgeHeight, -bridgeWidth / 2
    ];
    
    // 创建几何对象
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    // 创建线框 - 使用红色金属材质
    const frame = new THREE.LineSegments(geometry, materials.redMetal);
    frame.userData = { partType: isLeft ? '左侧梯形框架' : '右侧梯形框架' };
    frameGroup.add(frame);
    
    return frameGroup;
  };
  
  /**
   * 创建中间支撑柱和支座
   * @returns {THREE.Group} 包含左右支座的组
   */
  const createMiddlePillars = () => {
    const pillarGroup = new THREE.Group();
    
    /**
     * 创建左侧支座
     * @returns {THREE.Group} 左侧支座组件
     */
    const createLeftSupport = () => {
      const supportGroup = new THREE.Group();
      
      // 1. 创建支座铁片底座
      const basePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.26 * scale, 0.05 * scale, 0.45 * scale), // 铁片厚度0.05m
        materials.redMetal
      );
      basePlate.position.set(-4.5 * scale / 2, 0, 0); // 调整位置使底座底面高于地面，完全显露出来
      basePlate.userData = { partType: '左侧支座底座' };
      
      // 2. 创建支柱1
      const pillar1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 1 * scale, 0.04 * scale), // 支柱尺寸
        materials.redMetal
      );
      pillar1.position.set(-4.5 * scale / 2, 0.05 * scale + 1 * scale / 2, 0.1 * scale);
      pillar1.userData = { partType: '左侧支座支柱1' };
      
      // 3. 创建支柱2
      const pillar2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 1 * scale, 0.04 * scale), // 支柱尺寸
        materials.redMetal
      );
      pillar2.position.set(-4.5 * scale / 2, 0.05 * scale + 1 * scale / 2, -0.1 * scale);
      pillar2.userData = { partType: '左侧支座支柱2' };
      
      supportGroup.add(basePlate, pillar1, pillar2);
      return supportGroup;
    };
    
    /**
     * 创建右侧支座
     * @returns {THREE.Group} 右侧支座组件
     */
    const createRightSupport = () => {
      const supportGroup = new THREE.Group();
      
      // 1. 创建支座铁片底座
      const basePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.26 * scale, 0.05 * scale, 0.45 * scale),
        materials.redMetal
      );
      basePlate.position.set(4.5 * scale / 2, 0, 0);
      basePlate.userData = { partType: '右侧支座底座' };
      
      // 2. 创建支柱1
      const pillar1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 1 * scale, 0.04 * scale),
        materials.redMetal
      );
      pillar1.position.set(4.5 * scale / 2, 0.05 * scale + 1 * scale / 2, 0.1 * scale);
      pillar1.userData = { partType: '右侧支座支柱1' };
      
      // 3. 创建支柱2
      const pillar2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * scale, 1 * scale, 0.04 * scale),
        materials.redMetal
      );
      pillar2.position.set(4.5 * scale / 2, 0.05 * scale + 1 * scale / 2, -0.1 * scale);
      pillar2.userData = { partType: '右侧支座支柱2' };
      
      supportGroup.add(basePlate, pillar1, pillar2);
      return supportGroup;
    };
    
    pillarGroup.add(createLeftSupport(), createRightSupport());
    return pillarGroup;
  };

  /**
   * 创建桥面
   * 桥面总长9m，宽0.44m，整体为蓝色，顶面有两条红色线条
   * @returns {THREE.Group} 桥面组件
   */
  const createDeck = () => {
    const deckGroup = new THREE.Group();
    
    /**
     * 创建带红色线条的蓝色桥面材质
     * @returns {Array<THREE.MeshStandardMaterial>} 多材质数组
     */
    const createDeckWithLinesMaterial = () => {
      // 创建蓝色基础材质
      const blueMaterial = new THREE.MeshStandardMaterial({
        color: 0x2196F3,  // 蓝色桥面
        metalness: 0.8,
        roughness: 0.2
      });
      
      /**
       * 创建顶面带红色线条的材质
       * @returns {THREE.MeshStandardMaterial} 带纹理的材质
       */
      const topMaterial = () => {
        // 创建Canvas纹理绘制红色线条
        const canvas = document.createElement('canvas');
        canvas.width = 1024; // 足够的分辨率
        canvas.height = 128;  // 桥面宽度方向
        const ctx = canvas.getContext('2d');
        
        // 绘制蓝色背景
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制两条红色线条
        ctx.fillStyle = '#FF0000';
        const lineWidth = 10; // 线条宽度
        const line1Y = canvas.height / 2 - 25; // 上线条位置
        const line2Y = canvas.height / 2 + 25; // 下线条位置
        
        ctx.fillRect(0, line1Y, canvas.width, lineWidth);
        ctx.fillRect(0, line2Y, canvas.width, lineWidth);
        
        // 创建纹理材质
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(9 * scale / 10, 1); // 水平方向重复以匹配桥长
        
        return new THREE.MeshStandardMaterial({
          map: texture,
          color: 0x2196F3,
          metalness: 0.8,
          roughness: 0.2
        });
      };
      
      // 创建多材质数组（BoxGeometry的六个面）
      // [右, 左, 上, 下, 前, 后]
      return [
        blueMaterial,  // 右面
        blueMaterial,  // 左面
        topMaterial(), // 顶面（带红色线条）
        blueMaterial,  // 底面
        blueMaterial,  // 前面
        blueMaterial   // 后面
      ];
    };
    
    // 创建主桥面
    const mainDeck = new THREE.Mesh(
      new THREE.BoxGeometry(9 * scale, 0.1 * scale, 0.44 * scale),
      createDeckWithLinesMaterial()
    );
    mainDeck.position.set(0, 0.05 * scale + 1 * scale + (0.1 * scale / 2), 0); // 放置在支柱上方
    mainDeck.userData = { partType: '主桥面' };
    
    deckGroup.add(mainDeck);
    return deckGroup;
  };

  // 组装桥梁组件
  bridgeGroup.add(
    createMiddlePillars(),           // 1. 添加中间支撑柱
    createDeck(),                     // 2. 添加桥面
    createTrapezoidalFrame(-4.5 * scale, true),  // 3. 添加左侧梯形框架支架
    createTrapezoidalFrame(4.5 * scale, false)    // 4. 添加右侧梯形框架支架
  );
  
  // 将桥梁添加到场景
  scene.add(bridgeGroup);
  
    // 注：不再在前端生成测点数据，而是从后端API获取
}

/**
 * 可视化应力点标签和3D对象
 * 创建黑色测点球体和坐标系箭头
 * 在模态分析模式下显示
 */
function visualizeStressPoints() {
  // 清理可能存在的旧应力点对象
  if (scene.stressPoints) {
    scene.stressPoints.forEach(point => scene.remove(point))
  }
  
  // 初始化应力点数组
  scene.stressPoints = []
  stressLabels.value = []
  
  // 移除模式限制，在所有模式下都显示测点
  
  // 创建黑色材质用于测点球体 - 确保所有测点都是黑色的
  const blackMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x000000,
    emissive: 0x000000,
    transparent: false,
    opacity: 1.0
  });
  
  // 为每个应力点创建可视化对象
  bridgeData.value.stressPoints.forEach(point => {
    // 创建黑色测点球体 - 确保大小适中且明显可见（放大2倍）
    const sphereGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    // 复制黑色材质，以便单独修改每个球体的材质
    const sphereMaterial = blackMaterial.clone();
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(point.position.x, point.position.y, point.position.z);
    sphere.userData = { 
      isSensorPoint: true, 
      sensorData: point,
      originalColor: sphereMaterial.color.getHex()
    };
    
    // 创建坐标系箭头 - 表示测量方向，箭头长度随数据值动态变化
    // 使用点的数据值来动态调整箭头长度，确保最小值为2，最大值为8（放大使指针更明显）
    const baseArrowLength = 2;
    const maxArrowLength = 8;
    const dynamicArrowLength = baseArrowLength + (point.value * (maxArrowLength - baseArrowLength));
    
    // 对于传感器测点，我们总是显示三个方向的箭头（X轴：顺桥向，Y轴：竖向，Z轴：横向）
    // X轴箭头（红色）- 顺桥向
    const xArrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), // 正向
      new THREE.Vector3(point.position.x, point.position.y, point.position.z),
      dynamicArrowLength,
      0xFF0000, // 红色
      0.6, // 箭头头部长度（放大使指针更明显）
      0.3 // 箭头头部宽度（放粗使指针更明显）
    );
    
    // Y轴箭头（绿色）- 竖向
    const yArrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), // 向上
      new THREE.Vector3(point.position.x, point.position.y, point.position.z),
      dynamicArrowLength,
      0x00FF00, // 绿色
      0.6,
      0.3
    );
    
    // Z轴箭头（蓝色）- 横向
    const zDirection = point.position.z >= 0 ? 1 : -1; // 根据测点位置决定Z轴方向
    const zArrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, zDirection), // 指向外侧
      new THREE.Vector3(point.position.x, point.position.y, point.position.z),
      dynamicArrowLength,
      0x0000FF, // 蓝色
      0.6,
      0.3
    );
    
    // 将对象添加到场景和数组
    scene.add(sphere, xArrowHelper, yArrowHelper, zArrowHelper);
    scene.stressPoints.push(sphere, xArrowHelper, yArrowHelper, zArrowHelper);
  });
  
  // 更新标签显示
  updateLabelsVisibility()
}

/**
 * 更新模态可视化
 * 根据选中的模态阶数显示对应的变形效果
 */
function updateModeVisualization() {
  // 清理现有的模态变形对象
  clearModeDeformationObjects();
  
  if (!showModeDeformation.value || activeTab.value !== 'analysis') {
    return;
  }
  
  // 获取当前选中模态的数据
  const currentMode = modalData.value.modes[selectedMode.value - 1];
  if (!currentMode) {
    console.log('当前模态数据不存在，正在尝试初始化...');
    initModalData().then(() => {
      const updatedMode = modalData.value.modes[selectedMode.value - 1];
      if (updatedMode) {
        createModeDeformationVisualization(updatedMode);
      }
    });
    return;
  }
  
  console.log(`更新模态${selectedMode.value}可视化`);
  // 创建模态变形可视化对象
  createModeDeformationVisualization(currentMode);
  
  // 自动启动模态动画，增强视觉效果
  if (!isAnimating.value) {
    animateMode();
  }
}

/**
 * 创建模态变形可视化
 * @param {Object} mode - 当前模态数据
 */
function createModeDeformationVisualization(mode) {
  // 不再创建模态分析中的箭头，避免与黑色传感器测点的箭头冲突
  // 保留黑色传感器测点的动态箭头长度功能
  // 完全移除模态变形可视化，只显示黑色传感器测点
  
  // 清空modeDeformationObjects数组，确保没有残留的箭头对象
  clearModeDeformationObjects();
  
  // 可以在这里添加其他模态分析相关的可视化效果，但不创建箭头
}

/**
 * 创建变形线连接原始点和变形点
 * @param {Object} mode - 当前模态数据
 * @param {number} deformationScale - 变形缩放因子
 */
function createDeformationLines(mode, deformationScale = 1) {
  // 根据模态阶数使用不同的线条颜色
  const modeIndex = modalData.value.modes.indexOf(mode);
  const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
  const lineColor = colors[modeIndex % colors.length];
  
  const lineMaterial = new THREE.LineBasicMaterial({
    color: lineColor,
    linewidth: 3, // 加粗线条
    transparent: true,
    opacity: 0.8
  });
  
  mode.deformationPoints.forEach(point => {
    const startPoint = new THREE.Vector3(point.position.x, point.position.y, point.position.z);
    const endPoint = new THREE.Vector3(
      point.position.x + point.deformation.x * 4 * deformationScale, // 进一步放大变形效果
      point.position.y + point.deformation.y * 4 * deformationScale,
      point.position.z + point.deformation.z * 4 * deformationScale
    );
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    
    // 保存变形对象引用
    modeDeformationObjects.push(line);
    scene.add(line);
  });
}

/**
 * 清理模态变形可视化对象
 */
function clearModeDeformationObjects() {
  modeDeformationObjects.forEach(obj => {
    if (obj && scene) {
      scene.remove(obj);
      // 清理几何体和材质
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  });
  modeDeformationObjects = [];
}

/**
 * 启动或停止模态动画
 */
function animateMode() {
  if (isAnimating.value) {
    // 停止动画
    if (modalAnimationId) {
      cancelAnimationFrame(modalAnimationId);
      modalAnimationId = null;
    }
    isAnimating.value = false;
  } else {
    // 启动动画
    modeAmplitude = 0;
    modePhase = 0;
    isAnimating.value = true;
    startModeAnimation();
  }
}

/**
 * 开始模态动画循环
 */
function startModeAnimation() {
  if (!isAnimating.value) return;
  
  // 更新模态振动相位 - 加快动画速度
  modePhase += 0.03; // 增加动画速度
  modeAmplitude = Math.sin(modePhase); // 正弦振动
  
  // 更新所有变形对象的位置和大小
  updateDeformationObjects(modeAmplitude);
  
  // 请求下一帧动画
  modalAnimationId = requestAnimationFrame(startModeAnimation);
}

/**
 * 更新变形对象的位置和大小
 * @param {number} amplitude - 当前振幅系数
 */
function updateDeformationObjects(amplitude) {
  const currentMode = modalData.value.modes[selectedMode.value - 1];
  if (!currentMode) return;
  
  let objectIndex = 0;
  
  // 更新每个变形点的箭头和球体
  currentMode.deformationPoints.forEach(point => {
    // 更新箭头
    if (objectIndex < modeDeformationObjects.length && modeDeformationObjects[objectIndex] instanceof THREE.ArrowHelper) {
      const arrow = modeDeformationObjects[objectIndex];
      const scaledAmplitude = amplitude * 3; // 放大振幅
      
      // 更新箭头长度
      const direction = new THREE.Vector3(
        point.deformation.x,
        point.deformation.y,
        point.deformation.z
      ).normalize();
      
      arrow.setDirection(direction);
      arrow.setLength(
        Math.sqrt(
          point.deformation.x * point.deformation.x +
          point.deformation.y * point.deformation.y +
          point.deformation.z * point.deformation.z
        ) * Math.abs(scaledAmplitude),
        0.5,
        0.3
      );
    }
    objectIndex++;
    
    // 更新球体颜色（根据振幅变化）
    if (objectIndex < modeDeformationObjects.length && modeDeformationObjects[objectIndex] instanceof THREE.Mesh) {
      const sphere = modeDeformationObjects[objectIndex];
      // 根据振幅设置颜色渐变：从绿色到红色
      const intensity = Math.abs(amplitude);
      const r = Math.floor(intensity * 255);
      const g = Math.floor((1 - intensity) * 255);
      sphere.material.color.setRGB(r/255, g/255, 0);
    }
    objectIndex++;
    
    // 更新变形线
    if (objectIndex < modeDeformationObjects.length && modeDeformationObjects[objectIndex] instanceof THREE.Line) {
      const line = modeDeformationObjects[objectIndex];
      const startPoint = new THREE.Vector3(point.position.x, point.position.y, point.position.z);
      const endPoint = new THREE.Vector3(
        point.position.x + point.deformation.x * amplitude * 3,
        point.position.y + point.deformation.y * amplitude * 3,
        point.position.z + point.deformation.z * amplitude * 3
      );
      
      line.geometry.setFromPoints([startPoint, endPoint]);
    }
    objectIndex++;
  });
}

/**
 * 切换模态变形显示
 */
function toggleModeDeformation() {
  showModeDeformation.value = !showModeDeformation.value;
  updateModeVisualization();
}

/**
 * 重置模态分析视角
 */
function resetModeView() {
  camera.position.set(0, 60, 150); // 从上方查看模态变形
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
}

/**
 * 绘制刚度变化图表
 */
function drawStiffnessChart() {
  if (!stiffnessCanvas.value) return;
  
  const canvas = stiffnessCanvas.value;
  const ctx = canvas.getContext('2d');
  const data = modalData.value.stiffnessData;
  
  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 设置图表样式
  const padding = 40;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  const barWidth = chartWidth / (data.length * 2) - 5;
  
  // 绘制坐标轴
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  // X轴
  ctx.beginPath();
  ctx.moveTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();
  
  // Y轴
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.stroke();
  
  // 绘制标题
  ctx.fillStyle = '#333';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('桥梁各分区刚度与质量对比', canvas.width / 2, padding / 2);
  
  // 绘制柱状图
  const maxValue = 120; // 最大值
  
  data.forEach((item, index) => {
    const x = padding + index * (chartWidth / data.length);
    
    // 刚度柱子
    const stiffnessHeight = (item.stiffness / maxValue) * chartHeight;
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(x, canvas.height - padding - stiffnessHeight, barWidth, stiffnessHeight);
    
    // 质量柱子
    const massHeight = (item.mass / maxValue) * chartHeight;
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(x + barWidth + 5, canvas.height - padding - massHeight, barWidth, massHeight);
    
    // 绘制标签
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.section, x + barWidth + 2.5, canvas.height - padding + 20);
    
    // 绘制数值
    ctx.fillStyle = '#2196F3';
    ctx.fillText(item.stiffness.toFixed(1), x + barWidth / 2, canvas.height - padding - stiffnessHeight - 5);
    
    ctx.fillStyle = '#FF5722';
    ctx.fillText(item.mass.toFixed(1), x + barWidth + 5 + barWidth / 2, canvas.height - padding - massHeight - 5);
  });
  
  // 绘制图例
  ctx.textAlign = 'left';
  
  // 刚度图例
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(padding, padding + 10, 15, 15);
  ctx.fillStyle = '#333';
  ctx.fillText('刚度', padding + 25, padding + 22);
  
  // 质量图例
  ctx.fillStyle = '#FF5722';
  ctx.fillRect(padding + 100, padding + 10, 15, 15);
  ctx.fillStyle = '#333';
  ctx.fillText('质量', padding + 125, padding + 22);
}

/**
 * 更新应力标签的可见性和位置
 * 根据3D空间位置计算并更新2D屏幕坐标
 */
function updateLabelsVisibility() {
  // 清除所有旧标签元素
  stressLabels.value.forEach(label => {
    if (label.element?.parentNode) {
      label.element.parentNode.removeChild(label.element)
    }
  });
  stressLabels.value = [];
  
  // 只在模态分析模式下显示标签
  if (activeTab.value !== 'analysis' || !showLabels.value) {
    return;
  }
  
  // 确保场景、相机和容器已初始化
  if (!scene || !camera || !container.value) return;
  
  // 为每个应力点创建标签
  bridgeData.value.stressPoints.forEach((point, index) => {
    // 创建一个新的div元素作为标签
    const labelDiv = document.createElement('div');
    labelDiv.className = 'stress-label';
    labelDiv.textContent = point.name; // 显示测点编号
    
    // 设置标签样式
    Object.assign(labelDiv.style, {
      position: 'absolute',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      pointerEvents: 'auto',
      cursor: 'pointer',
      zIndex: 1000,
      transition: 'background-color 0.3s ease'
    });
    
    // 添加鼠标悬停事件监听器，显示详细信息
    labelDiv.addEventListener('mouseover', (event) => {
      // 创建tooltip元素
      const tooltip = document.createElement('div');
      tooltip.className = 'sensor-tooltip';
      
      // 构建详细信息内容
      const infoContent = `
        测点编号: ${point.name}<br>
        ID: ${point.id}<br>
        坐标: (${point.position.x.toFixed(2)}, ${point.position.y.toFixed(2)}, ${point.position.z.toFixed(2)})<br>
        传感器类型: ${point.sensorType === 'displacement' ? '位移' : point.sensorType === 'acceleration' ? '加速度' : '未知'}<br>
        测量方向: ${point.measuredDirections.map(dir => {
          if (dir === 'x') return '顺桥向(X)';
          if (dir === 'y') return '竖向(Y)';
          if (dir === 'z') return '横向(Z)';
          return dir;
        }).join(', ')}
      `;
      
      tooltip.innerHTML = infoContent;
      
      // 设置tooltip样式
      Object.assign(tooltip.style, {
        position: 'absolute',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 1001,
        whiteSpace: 'nowrap',
        left: `${event.clientX + 10}px`,
        top: `${event.clientY - 10}px`
      });
      
      // 添加到body
      document.body.appendChild(tooltip);
      
      // 保存tooltip引用，便于移除
      labelDiv._tooltip = tooltip;
      
      // 改变标签背景色表示悬停状态
      labelDiv.style.backgroundColor = 'rgba(0, 0, 128, 0.9)';
    });
    
    // 添加鼠标移出事件监听器，移除tooltip
    labelDiv.addEventListener('mouseout', () => {
      if (labelDiv._tooltip && labelDiv._tooltip.parentNode) {
        document.body.removeChild(labelDiv._tooltip);
        delete labelDiv._tooltip;
      }
      
      // 恢复标签背景色
      labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    });
    
    // 移除点击事件监听器，不再需要显示详情
    
    // 将标签添加到容器
    container.value.appendChild(labelDiv);
    
    // 保存标签引用
    stressLabels.value.push({
      element: labelDiv,
      point: point
    });
    
    // 计算并设置标签位置
    const vector = new THREE.Vector3(point.position.x, point.position.y, point.position.z);
    vector.project(camera);
    
    // 确保renderer和domElement存在
    if (renderer && renderer.domElement) {
      const canvas = renderer.domElement;
      const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = -(vector.y * 0.5 - 0.5) * canvas.clientHeight;
      
      labelDiv.style.left = `${x}px`;
      labelDiv.style.top = `${y}px`;
    }
  });
}

/**
 * 注：传感器测点详情显示功能已被移除
 * 不再需要显示传感器测点详情
 */

/**
 * 更新桥梁可视化状态
 * @param {Object} newData - 桥梁状态数据对象，包含status等状态信息
 * @description 根据传入的数据状态动态改变桥梁模型的颜色显示
 *              遍历所有桥梁组件，根据状态值(normal/warning/danger)设置对应颜色
 *              特别注意处理多材质情况，确保只修改特定的灰色和蓝色材质
 *              同时更新应力点可视化
 * 注：不再在前端生成测点数据，现在从后端API获取完整的30个测点数据
 */
// function generateSensorPoints() {
//   // 已移至后端实现
// }

function updateBridgeVisualization(newData) {
  // 确保bridgeGroup已初始化
  if (!bridgeGroup) return;
  
  // 遍历桥梁所有组件更新状态颜色
  bridgeGroup.children.forEach(group => {
    if (group instanceof THREE.Group) {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          // 处理材质数组情况（如桥面的多材质）
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => {
              // 安全检查：确保material.color存在
              if (material.color) {
                // 只修改原始的灰色/蓝色材质，保留红色系列材质
                if (material.color.getHex() === 0xCCCCCC || material.color.getHex() === 0x607D8B) {
                  // 根据状态设置不同颜色
                  material.color.set(
                    newData.status === 'normal' ? 0x4CAF50 : 
                    newData.status === 'warning' ? 0xFFC107 : 0xF44336
                  );
                }
              }
            });
          }
          // 处理单一材质情况
          else if (obj.material.color) {
            // 只修改特定材质颜色
            if (obj.material.color.getHex() === 0xCCCCCC || obj.material.color.getHex() === 0x607D8B) {
              obj.material.color.set(
                newData.status === 'normal' ? 0x4CAF50 : 
                newData.status === 'warning' ? 0xFFC107 : 0xF44336
              );
            }
          }
        }
      });
    }
  });
  
  // 更新应力点可视化
  visualizeStressPoints();
}

/**
 * 处理窗口大小变化事件
 * 更新相机宽高比和渲染器尺寸，保持场景正确显示
 */
function onWindowResize() {
  if (!container.value || !camera || !renderer) return;
  
  const containerRect = container.value.getBoundingClientRect();
  camera.aspect = containerRect.width / containerRect.height; // 更新宽高比
  camera.updateProjectionMatrix(); // 重新计算投影矩阵
  renderer.setSize(containerRect.width, containerRect.height); // 更新渲染器尺寸
  updateLabelsVisibility(); // 重新定位标签
}

/**
 * 处理鼠标移动事件
 * 使用射线检测识别测点球体的鼠标悬停
 */
function onMouseMove(event) {
  if (!container.value || !camera || !renderer) return;
  
  // 计算鼠标在归一化设备坐标系中的位置 (-1 到 +1)
  const containerRect = container.value.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - containerRect.left) / containerRect.width) * 2 - 1,
    -((event.clientY - containerRect.top) / containerRect.height) * 2 + 1
  );
  
  // 更新射线检测器
  raycaster.setFromCamera(mouse, camera);
  
  // 获取所有应力点对象
  const intersects = raycaster.intersectObjects(scene.stressPoints || [], true);
  
  // 找到第一个是测点球体的交点
  let sensorIntersect = null;
  for (let i = 0; i < intersects.length; i++) {
    const obj = intersects[i].object;
    if (obj.userData.isSensorPoint && obj instanceof THREE.Mesh) {
      sensorIntersect = intersects[i];
      break;
    }
  }
  
  // 处理悬停状态变化
  if (sensorIntersect) {
    const sensor = sensorIntersect.object;
    
    // 如果悬停在新的测点球体上
    if (hoveredSensor !== sensor) {
      // 恢复之前悬停球体的颜色
      if (hoveredSensor) {
        hoveredSensor.material.color.setHex(hoveredSensor.userData.originalColor);
      }
      
      // 设置新悬停球体的颜色为蓝色
      sensor.material.color.setHex(0x1976D2);
      hoveredSensor = sensor;
      
      // 创建tooltip显示测点信息
      const pointData = sensor.userData.sensorData;
      const tooltip = document.createElement('div');
      tooltip.className = 'sensor-tooltip-3d';
      
      // 构建详细信息内容
      const infoContent = `
        测点编号: ${pointData.name}<br>
        ID: ${pointData.id}<br>
        坐标: (${pointData.position.x.toFixed(2)}, ${pointData.position.y.toFixed(2)}, ${pointData.position.z.toFixed(2)})<br>
        传感器类型: ${pointData.sensorType === 'displacement' ? '位移' : pointData.sensorType === 'acceleration' ? '加速度' : '未知'}<br>
        测量方向: ${pointData.measuredDirections.map(dir => {
          if (dir === 'x') return '顺桥向(X)';
          if (dir === 'y') return '竖向(Y)';
          if (dir === 'z') return '横向(Z)';
          return dir;
        }).join(', ')}
      `;
      
      tooltip.innerHTML = infoContent;
      
      // 设置tooltip样式
      Object.assign(tooltip.style, {
        position: 'fixed',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 1001,
        whiteSpace: 'nowrap',
        left: `${event.clientX + 10}px`,
        top: `${event.clientY - 10}px`
      });
      
      // 添加到body
      document.body.appendChild(tooltip);
      
      // 保存tooltip引用，便于移除
      sensorIntersect.object._tooltip = tooltip;
    } else if (sensor._tooltip) {
      // 更新已存在tooltip的位置
      sensor._tooltip.style.left = `${event.clientX + 10}px`;
      sensor._tooltip.style.top = `${event.clientY - 10}px`;
    }
  } else {
    // 如果不再悬停在任何测点球体上
    if (hoveredSensor) {
      // 恢复颜色
      hoveredSensor.material.color.setHex(hoveredSensor.userData.originalColor);
      
      // 移除tooltip
      if (hoveredSensor._tooltip && hoveredSensor._tooltip.parentNode) {
        document.body.removeChild(hoveredSensor._tooltip);
        delete hoveredSensor._tooltip;
      }
      
      hoveredSensor = null;
    }
  }
}

/**
 * 注：桥梁点击功能已被移除
 * 不再需要处理桥梁模型点击事件和部件选择高亮功能
 */

/**
 * 获取应力值描述文本
 * @param {number} value - 应力值
 * @returns {string} 应力状态描述
 */
function getStressDesc(value) {
  return value < 0.5 ? '状态正常' : value < 0.7 ? '需要关注' : '警告：应力过高';
}

/**
 * 获取部件所属系统类型
 * @param {string} partType - 部件类型名称
 * @returns {string} 系统类型
 */
function getSystemType(partType) {
  if (partType.includes('螺栓')) return '锚固系统';
  if (partType.includes('护栏')) return '安全系统';
  return '主体结构';
}

/**
 * 动画循环函数
 * 实现平滑渲染和交互体验
 */
function animate() {
  requestAnimationFrame(animate); // 请求下一帧动画
  
  // 更新控制器状态
  controls.update();
  
  // 渲染场景
  renderer.render(scene, camera);
  
  // 更新标签位置
  updateLabelsVisibility();
}

/**
 * 切换应力标签显示状态
 */
function toggleLabels() {
  showLabels.value = !showLabels.value;
  updateLabelsVisibility();
}

/**
 * 重置相机视角到初始位置
 */
function resetView() {
  camera.position.set(100, 80, 120); // 恢复初始位置
  camera.lookAt(0, 0, 0); // 看向原点
  controls.reset(); // 重置控制器
}

/**
 * 模拟应力变化
 * 随机修改应力点数值并更新整体状态
 */
function simulateStressChange() {
  // 为每个应力点添加随机变化
  bridgeData.value.stressPoints.forEach(point => {
    // 限制应力值在-0.9到0.9之间，允许正负值以改变箭头方向
    point.value = Math.max(-0.9, Math.min(0.9, point.value + (Math.random() - 0.5) * 0.3));
  });
  
  // 根据平均绝对值应力值更新整体状态
  const avg = bridgeData.value.stressPoints.reduce((sum, point) => sum + Math.abs(point.value), 0) / 
              bridgeData.value.stressPoints.length;
  bridgeData.value.status = avg > 0.7 ? 'danger' : avg > 0.5 ? 'warning' : 'normal';
  
  // 不再渲染应力点和坐标系箭头
}

/**
 * 获取真实数据（模拟）
 * 实际项目中应替换为真实API请求
 */
function fetchRealData() {
  fetch(`${API_BASE_URL}/bridge-data/latest`)
    .then(res => res.json())
    .then(data => {
      // 直接使用后端返回的完整数据
      // 包括30个测点的所有属性：id、position、value、name、sensorType、measuredDirections
      bridgeData.value = data;
      
      connectionStatus.value = 'connected';
      
      // 更新应力点可视化
      visualizeStressPoints();
    })
    .catch(() => {
      connectionStatus.value = 'disconnected';
    });
}

/**
 * 获取状态文本描述
 * @param {string} status - 状态码
 * @returns {string} 中文状态描述
 */
function getStatusText(status) {
  return status === 'normal' ? '正常' : status === 'warning' ? '警告' : '危险';
}

/**
 * 获取应力等级
 * @param {number} value - 应力值
 * @returns {string} 应力等级：normal, warning, danger
 */
function getStressLevel(value) {
  return value < 0.5 ? 'normal' : value < 0.7 ? 'warning' : 'danger';
}

/**
 * 组件挂载时初始化场景和设置
 * @description 组件生命周期钩子，在组件挂载到DOM后执行初始化操作
 *              负责创建3D场景、启动动画循环、初始化数据获取
 *              设置定期刷新机制，确保数据实时更新
 *              是组件启动的核心入口点
 */
onMounted(() => {
  initScene(); // 初始化3D场景
  animate(); // 启动动画循环
  
  // 初始获取后端数据并可视化测点
  fetchRealData();
  
  // 定期刷新数据（每3秒），使传感器箭头能动态变化
  dataRefreshInterval = setInterval(() => {
    fetchRealData();
  }, 3000);
  
  // 定期检查连接状态
  connectionCheckInterval = setInterval(() => {
    fetch(`${API_BASE_URL}/bridge-data`)
      .then(() => connectionStatus.value = 'connected')
      .catch(() => connectionStatus.value = 'disconnected');
  }, 5000);
});

/**
 * 组件卸载时清理资源
 * @description 组件生命周期钩子，在组件从DOM中卸载前执行清理操作
 *              负责清除所有定时器，防止内存泄漏和无效的异步操作
 *              移除事件监听器，避免事件处理器在组件卸载后仍被调用
 *              清理所有DOM标签元素，确保不会在DOM中残留元素
 *              是保证组件安全卸载和内存管理的关键函数
 */
onUnmounted(() => {
  // 清理定时器
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  if (dataRefreshInterval) {
    clearInterval(dataRefreshInterval);
  }
  
  // 移除事件监听器
  window.removeEventListener('resize', onWindowResize);
  // 移除鼠标移动事件监听器
  if (renderer && renderer.domElement) {
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
  }
  // 移除桥梁点击功能，不再需要移除onBridgeClick事件监听器
  
  // 清理标签元素
  stressLabels.value.forEach(label => {
    if (label.element?.parentNode) {
      label.element.parentNode.removeChild(label.element);
    }
  });
});
</script>

<style scoped>
.bridge-monitoring-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  background-color: #2c3e50;
  color: white;
  padding: 0.8rem 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.bridge-container {
  flex: 7;
  position: relative;
}

.monitoring-panel {
  flex: 3;
  background-color: #f8f9fa;
  padding: 1.5rem;
  overflow-y: auto;
  border-left: 1px solid #e0e0e0;
}

.status-indicators {
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.8rem;
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.label {
  font-weight: 500;
  color: #333;
}

.status-value {
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-weight: 600;
}

.status-value.normal {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-value.warning {
  background-color: #fff8e1;
  color: #ff8f00;
}

.status-value.danger {
  background-color: #ffebee;
  color: #c62828;
}

.stress-points-section {
  margin: 2rem 0;
}

.stress-points-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 1rem;
}

.stress-point-item {
  background-color: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.point-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.stress-bar {
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.stress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.stress-fill.normal {
  background-color: #4CAF50;
}

.stress-fill.warning {
  background-color: #FFC107;
}

.stress-fill.danger {
  background-color: #F44336;
}

.controls-section {
  margin: 2rem 0;
}

.control-btn {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: #1976d2;
}

.connection-status {
  padding: 0.8rem 1.5rem;
  background-color: #f1f1f1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.status-indicator {
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-weight: 500;
}

.status-indicator.connected {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-indicator.disconnected {
  background-color: #ffebee;
  color: #c62828;
}

/* 应力标签样式 */
:deep(.stress-label) {
  pointer-events: none;
  transition: transform 0.2s;
}

:deep(.stress-label:hover) {
  transform: scale(1.1);
}

/* 标签页容器样式 */
.tabs-container {
  display: flex;
  justify-content: center;
  margin: 10px 0;
  padding: 0 20px;
}

.tab-btn {
  padding: 10px 25px;
  margin: 0 5px;
  border: none;
  background-color: #f5f5f5;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px 5px 0 0;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background-color: #e0e0e0;
}

.tab-btn.active {
  background-color: #1976D2;
  color: white;
  font-weight: bold;
}

/* 面板容器样式 */
.panel-container {
  width: 350px;
  height: 100%;
  overflow-y: auto;
}

/* 模态分析面板样式 */
.analysis-panel {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  height: 100%;
}

.analysis-panel h2 {
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

/* 模态选择器样式 */
.modal-selector {
  margin-bottom: 20px;
  padding: 10px;
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.modal-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.modal-selector select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
}

/* 模态频率表格样式 */
.modal-table-section {
  margin-bottom: 20px;
}

.modal-table-section h3 {
  color: #444;
  margin-bottom: 10px;
  font-size: 16px;
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.modal-table th,
.modal-table td {
  padding: 10px 8px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.modal-table th {
  background-color: #1976D2;
  color: white;
  font-weight: bold;
}

.modal-table tr:nth-child(even) {
  background-color: #f5f5f5;
}

.modal-table tr:hover {
  background-color: #e8f4fd;
}

/* 分区刚度图表样式 */
.stiffness-section {
  margin-bottom: 20px;
}

.stiffness-section h3 {
  color: #444;
  margin-bottom: 10px;
  font-size: 16px;
}

.stiffness-chart {
  background-color: white;
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: center;
}

.stiffness-chart canvas {
  max-width: 100%;
  height: auto;
}

/* 模态缩略图网格样式 */
.modal-thumbnails-section {
  margin-bottom: 20px;
}

.modal-thumbnails-section h3 {
  color: #444;
  margin-bottom: 10px;
  font-size: 16px;
}

.modal-thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.modal-thumbnail {
  background-color: white;
  padding: 12px;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  text-align: center;
  transition: all 0.3s ease;
}

.modal-thumbnail:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.modal-thumbnail.active {
  background-color: #1976D2;
  color: white;
  box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
}

.thumbnail-title {
  font-weight: bold;
  margin-bottom: 5px;
}

.thumbnail-frequency {
  font-size: 12px;
  opacity: 0.8;
}

/* 模态分析控制按钮样式 */
.analysis-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis-controls .control-btn {
  width: 100%;
  padding: 10px;
  border: none;
  background-color: #1976D2;
  color: white;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s ease;
  margin-right: 0;
  margin-bottom: 10px;
}

.analysis-controls .control-btn:hover {
  background-color: #1565C0;
}

.analysis-controls .control-btn:active {
  background-color: #0D47A1;
}
/* 适配CombinedAnalysis页面的样式 */
.bridge-monitoring-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.bridge-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #ffffff;
  overflow: hidden;
}

/* 移除所有多余的样式元素 */
.app-header,
.tabs-container,
.panel-container,
.connection-status {
  display: none !important;
}
</style>