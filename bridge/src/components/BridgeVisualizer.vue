<template>
  <div class="bridge-monitoring-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <h1>桥梁三维可视化监测系统</h1>
    </header>
    
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 3D 可视化区域 -->
      <div ref="container" class="bridge-container"></div>
      
      <!-- 数据监测面板 -->
      <div class="monitoring-panel">
        <h2>桥梁状态监测</h2>
        
        <div class="status-indicators">
          <div class="status-item">
            <span class="label">整体状态:</span>
            <span :class="['status-value', bridgeData.status]">
              {{ getStatusText(bridgeData.status) }}
            </span>
          </div>
          <div class="status-item">
            <span class="label">温度:</span>
            <span class="status-value">{{ bridgeData.temperature }}°C</span>
          </div>
          <div class="status-item">
            <span class="label">振动:</span>
            <span class="status-value">{{ bridgeData.vibration.toFixed(2) }}</span>
          </div>
        </div>
        
        <!-- 应力点列表 -->
        <div class="stress-points-section">
          <h3>应力监测点</h3>
          <div class="stress-points-list">
            <div v-for="(point, index) in bridgeData.stressPoints" :key="index" class="stress-point-item">
              <div class="point-info">
                <span class="point-position">位置: {{ point.name }}</span>
                <span class="point-value">应力: {{ point.value.toFixed(2) }}</span>
              </div>
              <div class="stress-bar">
                <div 
                  class="stress-fill" 
                  :class="getStressLevel(point.value)"
                  :style="{ width: `${point.value * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 交互控制 -->
        <div class="controls-section">
          <h3>交互控制</h3>
          <button class="control-btn" @click="toggleLabels">
            {{ showLabels ? '隐藏标签' : '显示标签' }}
          </button>
          <button class="control-btn" @click="resetView">重置视角</button>
          <button class="control-btn" @click="simulateStressChange">
            模拟应力变化
          </button>
          <button class="control-btn" @click="fetchRealData">
            获取实时数据
          </button>
        </div>
      </div>
    </div>
    
    <!-- 后端连接状态显示 -->
    <div class="connection-status">
      <span class="status-label">后端连接:</span>
      <span :class="['status-indicator', connectionStatus]">
        {{ connectionStatus === 'connected' ? '已连接' : '未连接' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const container = ref(null)
let scene, camera, renderer, controls, bridgeGroup, selectedPart = null

// 显示标签状态
const showLabels = ref(false)
const stressLabels = ref([])

// 模拟桥梁监测数据 - 根据示意图更新应力点数据
const bridgeData = ref({
  status: 'normal', // normal, warning, danger
  temperature: 25, // 摄氏度
  vibration: 0.3, // 振幅
  stressPoints: [
    { position: { x: -100, y: 0, z: 0 }, value: 0.4, name: '构件1（桥面）' },
    { position: { x: -70, y: 15, z: 10 }, value: 0.6, name: '构件2' },
    { position: { x: -50, y: 15, z: -10 }, value: 0.5, name: '构件3' },
    { position: { x: -20, y: 15, z: 0 }, value: 0.7, name: '构件4' },
    { position: { x: -70, y: 28, z: 10 }, value: 0.45, name: 'HL1' },
    { position: { x: 0, y: 15, z: 0 }, value: 0.55, name: '中间支座' }
  ]
})

// 后端连接状态
const connectionStatus = ref('disconnected');

// 用于存储定时器ID的引用
let connectionCheckInterval = null;

// 监听数据变化，更新3D模型
watch(bridgeData, (newData) => {
  updateBridgeVisualization(newData)
}, { deep: true })

// 创建场景
function initScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)
  
  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
  directionalLight.position.set(50, 100, 50)
  scene.add(directionalLight)
  
  // 添加相机
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000) // 暂时使用1:1比例
  camera.position.set(100, 80, 120)
  camera.lookAt(0, 0, 0)
  
  // 添加渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  
  // 获取容器实际大小并设置渲染器
  const containerRect = container.value.getBoundingClientRect()
  renderer.setSize(containerRect.width, containerRect.height)
  camera.aspect = containerRect.width / containerRect.height
  camera.updateProjectionMatrix()
  
  container.value.appendChild(renderer.domElement)
  
  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0, 0)
  
  // 创建立方体地面
  const groundGeometry = new THREE.BoxGeometry(300, 1, 300)
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.position.y = -50
  scene.add(ground)
  
  // 添加地面网格
  const gridHelper = new THREE.GridHelper(300, 30)
  scene.add(gridHelper)
  
  // 创建桥梁结构
  createBridge()
  
  // 添加坐标轴辅助
  const axesHelper = new THREE.AxesHelper(50)
  scene.add(axesHelper)
  
  // 处理窗口大小变化
  window.addEventListener('resize', onWindowResize)
  
  // 添加点击事件监测
  renderer.domElement.addEventListener('click', onBridgeClick)
}

// 创建基于示意图的桥梁模型 - 改进版
function createBridge() {
  // 创建桥梁组
  bridgeGroup = new THREE.Group()
  
  // 1. 基础配置：材质与尺寸映射（文档提取）
  // 材质区分（便于可视化识别部件）
  const materials = {
    deck: new THREE.MeshStandardMaterial({ color: new THREE.Color(0x888888), metalness: 0.3 }), // 桥面（构件1）
    mainComponent: new THREE.MeshStandardMaterial({
      color: bridgeData.value.status === 'normal' ? new THREE.Color(0x4CAF50) : 
             bridgeData.value.status === 'warning' ? new THREE.Color(0xFFC107) : new THREE.Color(0xF44336),
      metalness: 0.4 
    }), // 构件2-4
    hlPart: new THREE.MeshStandardMaterial({ color: new THREE.Color(0xaaaaaa), metalness: 0.2 }), // HL1-HL8
    clPart: new THREE.MeshStandardMaterial({ color: new THREE.Color(0xbbbbbb), metalness: 0.2 }), // CL2-CL12
    support: new THREE.MeshStandardMaterial({ color: new THREE.Color(0x555555), metalness: 0.5 }), // 中间支座
    bolt: new THREE.MeshStandardMaterial({ color: new THREE.Color(0xc0c0c0), metalness: 0.8 }) // 螺栓锚固
  };
  
  // 文档提取的关键尺寸（单位：默认米，按比例缩小以适应场景）
  const sizes = {
    // 构件1（桥面主体）：文档中多个20、15、25、10 → 推测长度200（20*10）、宽度30、高度15
    component1: { length: 200, width: 30, height: 15 },
    // 构件2-4：文档未明确单个尺寸，按常见比例适配构件1
    component2: { length: 80, width: 10, height: 8 },
    component3: { length: 60, width: 8, height: 6 },
    component4: { length: 50, width: 6, height: 5 },
    // HL系列（HL1-HL8）：HL1含15、25、40、30 → 取典型尺寸：长度40、宽度15、高度25
    hl: { length: 40, width: 15, height: 25 },
    // CL系列（CL2-CL12）：文档含10、13、11.33 → 典型尺寸：长度30、宽度8、高度10
    cl: { length: 30, width: 8, height: 10 },
    // 中间支座：文档45、60、45 → 长60、宽45、高45
    middleSupport: { length: 60, width: 45, height: 45 },
    // 螺栓：直径2、高度8（锚固连接常用尺寸）
    bolt: { radius: 2, height: 8 }
  };
  
  // 2. 创建构件1（桥面主体，文档核心构件）
  const createComponent1 = () => {
    const geo = new THREE.BoxGeometry(sizes.component1.length, sizes.component1.height, sizes.component1.width);
    const mesh = new THREE.Mesh(geo, materials.deck);
    // 桥面位置：Y轴0（基础高度），X轴居中（-length/2 → 0），Z轴0
    mesh.position.set(-sizes.component1.length / 2, 0, 0);
    // 绑定点击事件（用于传感器选中）
    mesh.userData.partType = "构件1（桥面）";
    return mesh;
  };
  
  // 3. 创建构件2-4（文档指定构件）
  const createMainComponents = () => {
    const componentsGroup = new THREE.Group();
    componentsGroup.name = "main-components";
    
    // 构件2：桥面上方左侧（支撑HL部件）
    const comp2 = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.component2.length, sizes.component2.height, sizes.component2.width),
      materials.mainComponent
    );
    comp2.position.set(-70, sizes.component1.height, 10); // 桥面上方Y=15，X=-70，Z=10
    comp2.userData.partType = "构件2";
    componentsGroup.add(comp2);
    
    // 构件3：桥面上方右侧（支撑CL部件）
    const comp3 = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.component3.length, sizes.component3.height, sizes.component3.width),
      materials.mainComponent
    );
    comp3.position.set(-50, sizes.component1.height, -10); // 桥面上方Y=15，X=-50，Z=-10
    comp3.userData.partType = "构件3";
    componentsGroup.add(comp3);
    
    // 构件4：桥面中间（连接中间支座）
    const comp4 = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.component4.length, sizes.component4.height, sizes.component4.width),
      materials.mainComponent
    );
    comp4.position.set(-20, sizes.component1.height, 0); // 桥面上方Y=15，X=-20，Z=0
    comp4.userData.partType = "构件4";
    componentsGroup.add(comp4);
    
    return componentsGroup;
  };
  
  // 4. 创建HL系列部件（HL1-HL8，文档重复出现）
  const createHLParts = () => {
    const hlGroup = new THREE.Group();
    hlGroup.name = "hl-parts";
    
    // HL1：构件2上方（文档HL1含15、25、40尺寸）
    const hl1 = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.hl.length, sizes.hl.height, sizes.hl.width),
      materials.hlPart
    );
    hl1.position.set(-70, sizes.component1.height + sizes.component2.height, 10); // 构件2上方
    hl1.userData.partType = "HL1";
    hlGroup.add(hl1);
    
    // HL2-HL8：按文档重复分布（沿桥面长度方向排列，间隔15）
    [2, 3, 4, 5, 6, 7, 8].forEach((num) => {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(sizes.hl.length, sizes.hl.height, sizes.hl.width),
        materials.hlPart
      );
      const xPos = -70 + num * 15; // 沿X轴间隔15排列
      hl.position.set(xPos, sizes.component1.height, 5); // 桥面上方Y=15，Z=5
      hl.userData.partType = `HL${num}`;
      hlGroup.add(hl);
    });
    
    return hlGroup;
  };
  
  // 5. 创建CL系列部件（CL2-CL12，文档含10、13等尺寸）
  const createCLParts = () => {
    const clGroup = new THREE.Group();
    clGroup.name = "cl-parts";
    
    // CL2-CL12：沿桥面右侧排列（间隔12，文档CL系列重复出现）
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((num) => {
      const cl = new THREE.Mesh(
        new THREE.BoxGeometry(sizes.cl.length, sizes.cl.height, sizes.cl.width),
        materials.clPart
      );
      const xPos = -80 + num * 12; // 沿X轴间隔12排列
      cl.position.set(xPos, sizes.component1.height, -15); // 桥面上方Y=15，Z=-15
      cl.userData.partType = `CL${num}`;
      clGroup.add(cl);
    });
    
    return clGroup;
  };
  
  // 6. 创建中间支座（文档指定，尺寸45、60、45）
  const createMiddleSupport = () => {
    const supportGroup = new THREE.Group();
    supportGroup.name = "middle-support";
    
    // 支座主体（长方体，尺寸60*45*45）
    const supportMain = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.middleSupport.length, sizes.middleSupport.height, sizes.middleSupport.width),
      materials.support
    );
    // 支座位置：桥面下方（Y=-45），X=0（桥面中间），Z=0
    supportMain.position.set(0, -sizes.middleSupport.height, 0);
    supportMain.userData.partType = "中间支座";
    supportGroup.add(supportMain);
    
    // 支座顶部连接（与构件4对接）
    const supportTop = new THREE.Mesh(
      new THREE.BoxGeometry(sizes.component4.length, 5, sizes.component4.width),
      materials.support
    );
    supportTop.position.set(-20, 0, 0); // 桥面Y=0处，与构件4对接
    supportGroup.add(supportTop);
    
    return supportGroup;
  };
  
  // 7. 创建螺栓锚固连接（文档指定，构件连接处）
  const createBoltConnections = () => {
    const boltGroup = new THREE.Group();
    boltGroup.name = "bolts";
    
    // 螺栓几何体（圆柱体，半径2，高度8）
    const boltGeo = new THREE.CylinderGeometry(sizes.bolt.radius, sizes.bolt.radius, sizes.bolt.height);
    // 螺栓旋转90度（沿X轴，使其垂直于构件表面）
    boltGeo.rotateX(Math.PI / 2);
    
    // 构件4与支座连接处的螺栓（4个，呈矩形分布）
    const boltPositions = [
      [-25, 5, 2], [-15, 5, 2], [-25, 5, -2], [-15, 5, -2]
    ];
    boltPositions.forEach(([x, y, z], idx) => {
      const bolt = new THREE.Mesh(boltGeo, materials.bolt);
      bolt.position.set(x, y, z);
      bolt.userData.partType = `螺栓${idx + 1}`;
      boltGroup.add(bolt);
    });
    
    // HL1与构件2连接处的螺栓（2个）
    const hlBoltPositions = [[-75, 28, 10], [-65, 28, 10]];
    hlBoltPositions.forEach(([x, y, z], idx) => {
      const bolt = new THREE.Mesh(boltGeo, materials.bolt);
      bolt.position.set(x, y, z);
      bolt.userData.partType = `HL1螺栓${idx + 1}`;
      boltGroup.add(bolt);
    });
    
    return boltGroup;
  };
  
  // 8. 整合所有模块到桥梁组
  bridgeGroup.add(
    createComponent1(),       // 构件1（桥面）
    createMainComponents(),   // 构件2-4
    createHLParts(),          // HL1-HL8
    createCLParts(),          // CL2-CL12
    createMiddleSupport(),    // 中间支座
    createBoltConnections()   // 螺栓锚固
  );
  
  scene.add(bridgeGroup);
  
  // 保存对主桥身的引用，用于状态更新
  const mainComponents = bridgeGroup.getObjectByName('main-components');
  
  // 可视化应力点
  visualizeStressPoints();
}

// 可视化应力点
function visualizeStressPoints() {
  // 清除旧的应力点
  if (scene.stressPoints) {
    scene.stressPoints.forEach(point => scene.remove(point))
  }
  
  scene.stressPoints = []
  stressLabels.value = []
  
  bridgeData.value.stressPoints.forEach(point => {
    // 创建应力球
    const sphereGeometry = new THREE.SphereGeometry(0.5 + point.value * 1.5, 32, 32)
    
    // 根据应力值设置颜色
    let color
    if (point.value < 0.5) {
      color = 0x4CAF50 // 绿色 - 正常
    } else if (point.value < 0.7) {
      color = 0xFFC107 // 黄色 - 警告
    } else {
      color = 0xF44336 // 红色 - 危险
    }
    
    const sphereMaterial = new THREE.MeshStandardMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.8
    })
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    sphere.position.set(point.position.x, point.position.y + 3, point.position.z)
    scene.add(sphere)
    scene.stressPoints.push(sphere)
  })
  
  // 更新标签显示
  updateLabelsVisibility()
}

// 更新标签可见性
function updateLabelsVisibility() {
  // 简单的标签实现
  if (stressLabels.value.length > 0) {
    stressLabels.value.forEach(label => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element)
      }
    })
  }
  
  stressLabels.value = []
  
  if (showLabels.value && scene.stressPoints) {
    bridgeData.value.stressPoints.forEach((point, index) => {
      const labelDiv = document.createElement('div')
      labelDiv.className = 'stress-label'
      labelDiv.textContent = `${point.name}: ${point.value.toFixed(2)}`
      labelDiv.style.position = 'absolute'
      labelDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
      labelDiv.style.color = 'white'
      labelDiv.style.padding = '2px 6px'
      labelDiv.style.borderRadius = '3px'
      labelDiv.style.fontSize = '12px'
      labelDiv.style.pointerEvents = 'none'
      labelDiv.style.zIndex = '100'
      
      document.body.appendChild(labelDiv)
      
      // 将3D坐标转换为2D屏幕坐标
      const vector = new THREE.Vector3(
        point.position.x,
        point.position.y + 5,
        point.position.z
      )
      vector.project(camera)
      
      const x = Math.round((vector.x + 1) * window.innerWidth / 2)
      const y = Math.round((-vector.y + 1) * window.innerHeight / 2)
      
      labelDiv.style.left = `${x}px`
      labelDiv.style.top = `${y}px`
      
      stressLabels.value.push({ element: labelDiv })
    })
  }
}

// 更新桥梁可视化
function updateBridgeVisualization(newData) {
  // 更新主组件颜色
  const mainComponents = bridgeGroup.getObjectByName('main-components');
  if (mainComponents) {
    mainComponents.children.forEach(child => {
      child.material.color.set(
        newData.status === 'normal' ? 0x4CAF50 : 
        newData.status === 'warning' ? 0xFFC107 : 0xF44336
      );
    });
  }
  
  // 重新可视化应力点
  visualizeStressPoints()
}

// 窗口大小变化处理
function onWindowResize() {
  // 获取容器实际大小
  const containerRect = container.value.getBoundingClientRect()
  
  // 更新相机和渲染器
  camera.aspect = containerRect.width / containerRect.height
  camera.updateProjectionMatrix()
  renderer.setSize(containerRect.width, containerRect.height)
  
  updateLabelsVisibility()
}

// 点击事件处理
function onBridgeClick(event) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  
  // 检测是否点击了应力点
  const intersects = raycaster.intersectObjects(scene.stressPoints || [])
  
  if (intersects.length > 0) {
    const clickedPoint = intersects[0].object
    // 找到对应的应力点数据
    const pointIndex = scene.stressPoints.indexOf(clickedPoint)
    if (pointIndex !== -1) {
      const pointData = bridgeData.value.stressPoints[pointIndex]
      alert(`点击了${pointData.name}\n应力值: ${pointData.value.toFixed(2)}`)
    }
  } else {
    // 检测是否点击了桥梁部件
    const bridgeIntersects = raycaster.intersectObjects(bridgeGroup.children, true);
    if (bridgeIntersects.length > 0) {
      const clickedPart = bridgeIntersects[0].object;
      if (clickedPart.userData && clickedPart.userData.partType) {
        // 高亮显示选中的部件
        if (selectedPart) {
          selectedPart.material.emissive.set(0x000000); // 重置之前选中的部件
        }
        clickedPart.material.emissive.set(0x555555); // 高亮当前选中的部件
        selectedPart = clickedPart;
        
        alert(`点击了部件: ${clickedPart.userData.partType}`);
      }
    }
  }
}

// 动画循环
function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  updateLabelsVisibility()
}

// 切换标签显示
function toggleLabels() {
  showLabels.value = !showLabels.value
  updateLabelsVisibility()
}

// 重置视角
function resetView() {
  camera.position.set(100, 80, 120)
  camera.lookAt(0, 0, 0)
  controls.reset()
}

// 模拟应力变化
function simulateStressChange() {
  // 随机更新每个应力点的值
  bridgeData.value.stressPoints.forEach(point => {
    point.value = Math.max(0.1, Math.min(0.9, point.value + (Math.random() - 0.5) * 0.2))
  })
  
  // 更新整体状态
  const avgStress = bridgeData.value.stressPoints.reduce((sum, point) => sum + point.value, 0) / bridgeData.value.stressPoints.length
  if (avgStress > 0.7) {
    bridgeData.value.status = 'danger'
  } else if (avgStress > 0.5) {
    bridgeData.value.status = 'warning'
  } else {
    bridgeData.value.status = 'normal'
  }
  
  // 更新温度和振动
  bridgeData.value.temperature += (Math.random() - 0.5) * 2
  bridgeData.value.vibration = Math.max(0.1, Math.min(0.8, bridgeData.value.vibration + (Math.random() - 0.5) * 0.1))
}

// 获取实时数据
async function fetchRealData() {
  try {
    // 显示加载状态
    const btn = event?.target;
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '加载中...';
      btn.disabled = true;
    }
    
    // 调用后端API
    const response = await fetch('http://localhost:3000/api/bridge-data/latest');
    
    if (!response.ok) {
      throw new Error('网络响应错误');
    }
    
    const data = await response.json();
    
    // 更新桥梁数据
    bridgeData.value = data;
    
    // 更新连接状态
    connectionStatus.value = 'connected';
    
  } catch (error) {
    console.error('获取后端数据失败:', error);
    connectionStatus.value = 'disconnected';
    alert('获取后端数据失败，请检查后端服务是否已启动。');
  } finally {
    // 恢复按钮状态
    if (event?.target) {
      event.target.textContent = '获取实时数据';
      event.target.disabled = false;
    }
  }
}

// 检查后端连接状态
function checkBackendConnection() {
  fetch('http://localhost:3000/api/bridge-data')
    .then(response => {
      if (response.ok) {
        connectionStatus.value = 'connected';
        return response.json();
      } else {
        throw new Error('连接失败');
      }
    })
    .catch(() => {
      connectionStatus.value = 'disconnected';
    });
}

// 生命周期钩子
onMounted(() => {
  initScene();
  animate();
  
  // 初始检查连接
  checkBackendConnection();
  
  // 定时检查连接（每10秒）并保存引用
  connectionCheckInterval = setInterval(checkBackendConnection, 10000);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  if (renderer && renderer.domElement) {
    renderer.domElement.removeEventListener('click', onBridgeClick);
  }
  renderer.dispose();
  
  // 清理定时器
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  
  // 清理标签
  if (stressLabels.value.length > 0) {
    stressLabels.value.forEach(label => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
  }
});

// 辅助函数
function getStatusText(status) {
  switch(status) {
    case 'normal': return '正常';
    case 'warning': return '警告';
    case 'danger': return '危险';
    default: return '未知';
  }
}

function getStressLevel(value) {
  if (value > 0.7) return 'danger';
  if (value > 0.5) return 'warning';
  return 'normal';
}
</script>

<style scoped>
.bridge-monitoring-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  background: #2196F3;
  color: white;
  padding: 10px 20px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 100;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.bridge-container {
  flex: 1;
  position: relative;
  background-color: #f0f0f0;
  min-height: 0;
}

.monitoring-panel {
  width: 320px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  z-index: 10;
  position: relative;
}

.monitoring-panel h2 {
  margin-top: 0;
  color: #333;
  font-size: 18px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.monitoring-panel h3 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #555;
  font-size: 14px;
}

.status-indicators {
  margin-bottom: 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.label {
  color: #666;
}

.status-value {
  font-weight: bold;
  color: #333;
}

.status-value.normal {
  color: #4CAF50;
}

.status-value.warning {
  color: #FFC107;
}

.status-value.danger {
  color: #F44336;
}

.stress-points-list {
  margin-top: 10px;
}

.stress-point-item {
  margin-bottom: 12px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.point-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: #666;
}

.stress-bar {
  width: 100%;
  height: 8px;
  background: #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.stress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.stress-fill.normal {
  background: #4CAF50;
}

.stress-fill.warning {
  background: #FFC107;
}

.stress-fill.danger {
  background: #F44336;
}

.controls-section {
  margin-top: 20px;
}

.control-btn {
  display: block;
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.control-btn:hover {
  background: #1976D2;
}

/* 添加连接状态样式 */
.connection-status {
  margin-top: 15px;
  padding: 8px;
  background: #f0f8ff;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.status-label {
  color: #666;
}

.status-indicator {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
}

.status-indicator.connected {
  background: #d4edda;
  color: #155724;
}

.status-indicator.disconnected {
  background: #f8d7da;
  color: #721c24;
}
</style>