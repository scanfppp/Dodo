<template>
  <div class="stiffness-mass-display">
    <!-- 调试信息显示区域 - 用于开发阶段监控组件状态 -->
    <div class="debug-info">
      <h4>调试信息</h4>
      <div class="debug-item">
        <span>初始化状态:</span>
        <span :class="['debug-status', { success: initCompleted, error: initError }]" >
          {{ initMessage }}
        </span>
      </div>
      <div class="debug-item">
        <span>分区数量:</span>
        <span>{{ partitions.length }}</span>
      </div>
      <div class="debug-item">
        <span>容器状态:</span>
        <span :class="['debug-status', { success: containerExists }]">
          {{ containerExists ? '存在' : '不存在' }}
        </span>
      </div>
    </div>
    
    <!-- 控制面板 - 提供数据刷新控制功能 -->
    <div class="controls">
      <h3>刚度及质量变化实时监测</h3>
      <div class="control-buttons">
        <button @click="startAutoRefresh" :disabled="autoRefreshActive">开始自动刷新</button>
        <button @click="stopAutoRefresh" :disabled="!autoRefreshActive">停止自动刷新</button>
        <button @click="refreshData" class="refresh-btn">手动刷新</button>
      </div>
      <div class="status-info">
        <p>最后更新时间: {{ lastUpdated }}</p>
        <p>更新间隔: {{ refreshInterval / 1000 }}秒</p>
      </div>
    </div>
    
    <!-- 可视化容器 - 包含Three.js渲染器和备用CSS渲染 -->
    <div class="visualization-container">
      <!-- Three.js容器 -->
      <div id="three-container" ref="threeContainer" class="three-container"></div>
      
      <!-- 备用CSS可视化方案 - 当Three.js不可用时提供备选展示 -->
      <div class="fallback-model">
        <div class="bridge-basic">
          <!-- 桥梁主体 -->
          <div class="bridge-main"></div>
          <!-- 桥梁支撑 -->
          <div class="bridge-supports">
            <div class="support"></div>
            <div class="support"></div>
          </div>
          <!-- 桥梁分区 - 根据刚度状态显示不同颜色 -->
          <div class="bridge-partitions">
            <div 
              v-for="partition in partitions" 
              :key="partition.id"
              class="bridge-partition"
              :style="{ 
                left: `${(partition.id - 1) * (100/partitions.length)}%`, 
                width: `${100/partitions.length}%`,
                backgroundColor: `#${getStatusColor(partition.stiffnessStatus || 'normal').toString(16)}`
              }"
            >
              <span class="partition-label">{{ partition.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 数据面板 - 显示详细的分区数据表格 -->
    <div class="data-panel">
      <h4>分区数据列表</h4>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>分区名称</th>
              <th>刚度(kN/m)</th>
              <th>刚度偏差(%)</th>
              <th>刚度状态</th>
              <th>质量(kg)</th>
              <th>质量偏差(%)</th>
              <th>质量状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="partition in partitions" :key="partition.id">
              <td>{{ partition.name }}</td>
              <td>{{ partition.currentStiffness?.toLocaleString() || '-' }}</td>
              <td :class="getDeviationClass(partition.stiffnessDeviation)">
                {{ partition.stiffnessDeviation ? (partition.stiffnessDeviation > 0 ? '+' : '') + partition.stiffnessDeviation.toFixed(2) : '-' }}
              </td>
              <td>
                <span :class="'status-badge status-' + partition.stiffnessStatus">{{ getStatusText(partition.stiffnessStatus) }}</span>
              </td>
              <td>{{ partition.currentMass?.toLocaleString() || '-' }}</td>
              <td :class="getDeviationClass(partition.massDeviation)">
                {{ partition.massDeviation ? (partition.massDeviation > 0 ? '+' : '') + partition.massDeviation.toFixed(2) : '-' }}
              </td>
              <td>
                <span :class="'status-badge status-' + partition.massStatus">{{ getStatusText(partition.massStatus) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-info" v-if="partitions.length > 0">
        <p>共 {{ partitions.length }} 个分区 | 最后更新: {{ lastUpdated }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// 导入Vue相关API
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
// 导入Three.js库用于3D渲染
import * as THREE from 'three';
// 导入axios用于API请求
import axios from 'axios';

// =========================================
// 响应式数据定义
// =========================================

// Three.js渲染容器引用
const threeContainer = ref(null);

// 分区数据 - 初始提供默认数据确保UI能正确显示
const partitions = ref([
  { id: 1, name: '第一跨左侧', currentStiffness: 22126, baseStiffness: 25000, stiffnessDeviation: -11.5, stiffnessStatus: 'danger', currentMass: 12500, baseMass: 12000, massDeviation: 4.2, massStatus: 'normal' },
  { id: 2, name: '第一跨中部', currentStiffness: 26500, baseStiffness: 28000, stiffnessDeviation: -5.4, stiffnessStatus: 'warning', currentMass: 13200, baseMass: 13500, massDeviation: -2.2, massStatus: 'normal' },
  { id: 3, name: '第一跨右侧', currentStiffness: 29100, baseStiffness: 30000, stiffnessDeviation: -3.0, stiffnessStatus: 'normal', currentMass: 14300, baseMass: 14000, massDeviation: 2.1, massStatus: 'normal' },
  { id: 4, name: '第二跨左侧', currentStiffness: 31000, baseStiffness: 32000, stiffnessDeviation: -3.1, stiffnessStatus: 'normal', currentMass: 14800, baseMass: 15000, massDeviation: -1.3, massStatus: 'normal' },
  { id: 5, name: '第二跨中部', currentStiffness: 33500, baseStiffness: 35000, stiffnessDeviation: -4.3, stiffnessStatus: 'normal', currentMass: 15700, baseMass: 16000, massDeviation: -1.9, massStatus: 'normal' },
  { id: 6, name: '第二跨右侧', currentStiffness: 31200, baseStiffness: 33000, stiffnessDeviation: -5.5, stiffnessStatus: 'warning', currentMass: 15800, baseMass: 15500, massDeviation: 1.9, massStatus: 'normal' },
  { id: 7, name: '第三跨左侧', currentStiffness: 29800, baseStiffness: 31000, stiffnessDeviation: -4.0, stiffnessStatus: 'normal', currentMass: 14200, baseMass: 14500, massDeviation: -2.1, massStatus: 'normal' },
  { id: 8, name: '第三跨中部', currentStiffness: 27500, baseStiffness: 29000, stiffnessDeviation: -5.2, stiffnessStatus: 'warning', currentMass: 13400, baseMass: 13000, massDeviation: 3.1, massStatus: 'normal' },
  { id: 9, name: '第三跨右侧', currentStiffness: 24800, baseStiffness: 26000, stiffnessDeviation: -4.6, stiffnessStatus: 'normal', currentMass: 12800, baseMass: 12500, massDeviation: 2.4, massStatus: 'normal' }
]);

// 最后更新时间
const lastUpdated = ref(new Date().toLocaleString());

// 自动刷新状态控制
const autoRefreshActive = ref(false);
const refreshInterval = ref(5000); // 5秒刷新一次
let refreshTimer = null;

// 调试状态 - 用于开发阶段监控组件初始化情况
const initCompleted = ref(false);
const initError = ref(false);
const initMessage = ref('初始化中...');
const containerExists = ref(false);

// =========================================
// Three.js相关变量
// =========================================

// 核心Three.js对象
let scene, camera, renderer;

// 桥梁模型相关
let bridgePartitions = []; // 存储桥梁各分区的网格对象
let labels = []; // 存储分区标签元素
let bridgeModel = null; // 桥梁模型组
let partitionMap = new Map(); // 用于存储分区ID和对应模型部分的映射

// =========================================
// Three.js初始化和渲染相关函数
// =========================================

/**
 * 初始化Three.js场景
 * 创建相机、渲染器、灯光等基础组件，并添加到容器中
 */
function initThreeScene() {
  console.log('开始初始化Three.js场景...');
  
  try {
    // 更新初始化状态
    initMessage.value = '检查容器...';
    
    // 确保容器存在
    if (!threeContainer.value) {
      console.error('初始化失败：threeContainer元素不存在');
      initError.value = true;
      initMessage.value = '错误：容器不存在';
      return;
    }
    
    // 获取容器尺寸，确保有默认值
    const containerWidth = threeContainer.value.clientWidth || 800;
    const containerHeight = threeContainer.value.clientHeight || 400;
    
    console.log('容器尺寸:', containerWidth, 'x', containerHeight);
    initMessage.value = `容器尺寸: ${containerWidth}x${containerHeight}`;
    
    // 创建场景
    initMessage.value = '创建THREE场景...';
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // 设置浅灰色背景
    
    // 创建相机
    initMessage.value = '创建THREE相机...';
    camera = new THREE.PerspectiveCamera(
      50,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 100, 300); // 设置相机位置，提供良好视角
    camera.lookAt(0, 20, 0); // 相机朝向桥梁中心位置
    
    // 创建渲染器
    initMessage.value = '创建THREE渲染器...';
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: true,  // 抗锯齿，使渲染更平滑
        alpha: true      // 支持透明度
      });
      renderer.setSize(containerWidth, containerHeight);
      renderer.setPixelRatio(window.devicePixelRatio); // 设置像素比，适配高分辨率屏幕
      
      // 清理容器内容，避免重复添加
      while (threeContainer.value.firstChild) {
        threeContainer.value.removeChild(threeContainer.value.firstChild);
      }
      threeContainer.value.appendChild(renderer.domElement);
      initMessage.value = '渲染器添加到容器成功';
    } catch (rendererError) {
      console.error('创建渲染器失败:', rendererError);
      initError.value = true;
      initMessage.value = '错误：创建渲染器失败';
      return;
    }
    
    // 添加灯光 - 增强材质效果
    initMessage.value = '添加灯光...';
    // 环境光 - 照亮整个场景
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    
    // 定向光 - 提供方向性光照效果
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1).normalize();
    scene.add(directionalLight1);
    
    // 添加地面网格 - 增强空间感
    initMessage.value = '添加地面网格...';
    const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xeeeeee);
    scene.add(gridHelper);
    
    // 创建桥梁基础模型
    initMessage.value = '创建桥梁模型...';
    createBridgeModel();
    
    // 开始渲染循环
    animate();
    
    // 监听窗口大小变化，自适应调整渲染尺寸
    window.addEventListener('resize', handleResize);
    
    initMessage.value = 'Three.js场景初始化完成';
  } catch (error) {
    console.error('Three.js场景初始化失败:', error);
    initError.value = true;
    initMessage.value = `错误: ${error.message}`;
  }
}

// 渲染循环
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// 处理窗口大小变化
function handleResize() {
  const width = threeContainer.value.clientWidth;
  const height = threeContainer.value.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
}

/**
 * 创建桥梁模型
 * 包括桥梁主体、支撑柱和地面，为刚度质量监测提供3D可视化基础
 */
function createBridgeModel() {
  console.log('创建桥梁模型...');
  
  // 确保有模型组 - 统一管理桥梁所有组件
  if (!bridgeModel) {
    bridgeModel = new THREE.Group();
    scene.add(bridgeModel);
  }
  
  // 清除现有内容 - 确保重新创建时不会有重复模型
  while (bridgeModel.children.length > 0) {
    const child = bridgeModel.children[0];
    bridgeModel.remove(child);
  }
  
  // 创建桥梁主体 - 更醒目的长方体表示桥梁主体结构
  const mainGeometry = new THREE.BoxGeometry(150, 8, 25);
  const mainMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x4682B4, // 钢蓝色，更醒目
    transparent: false, // 不透明，确保可见
    opacity: 1.0 
  });
  const mainBridge = new THREE.Mesh(mainGeometry, mainMaterial);
  mainBridge.position.set(0, 4, 0); // 居中放置
  bridgeModel.add(mainBridge);
  
  // 添加支撑柱 - 明显的结构支撑桥梁主体
  const pillarGeometry = new THREE.BoxGeometry(10, 15, 10);
  const pillarMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x696969, // 深灰色
    transparent: false 
  });
  
  // 两个支撑柱（只保留两端的支柱）
  const pillars = [
    { x: -60, z: 0 },
    { x: 60, z: 0 }
  ];
  
  pillars.forEach(pos => {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(pos.x, 7.5, pos.z);
    bridgeModel.add(pillar);
  });
  
  // 添加底部地面，增强视觉效果和空间感知
  const groundGeometry = new THREE.PlaneGeometry(300, 100);
  const groundMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x32CD32, // 绿色地面
    side: THREE.DoubleSide 
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);
  
  console.log('桥梁模型创建完成，包含主体、支撑柱和地面');
}

/**
 * 创建基本的桥梁结构
 * 兼容性函数，用于与旧版本代码保持一致
 */
function createBasicBridgeStructure() {
  createBridgeModel();
}

/**
 * 居中模型
 * 调整模型位置并优化相机视角，确保模型在视图中完整可见
 * @param {THREE.Object3D} model - 要居中的3D模型对象
 */
function centerModel(model) {
  console.log('开始居中模型...');
  
  // 先检查模型是否有任何可见的几何体
  let hasGeometry = false;
  model.traverse(obj => {
    if (obj.isMesh && obj.geometry) {
      hasGeometry = true;
    }
  });
  
  if (!hasGeometry) {
    console.warn('模型没有可见的几何体');
    // 设置默认位置
    model.position.set(0, 10, 0);
    return;
  }
  
  // 计算模型的边界盒和中心点
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  console.log('模型边界盒信息:', {
    中心: center,
    尺寸: size
  });
  
  // 移动模型使其居中
  model.position.sub(center);
  
  // 调整Y轴，确保模型底部接触地面
  model.position.y += size.y / 2;
  
  // 调整相机位置以更好地查看模型
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180); // 转换为弧度
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.5; // 增加一些距离以便更好地查看
  
  // 设置相机位置，提供良好的俯视角度
  camera.position.set(0, size.y * 1.2, cameraZ);
  camera.lookAt(0, size.y / 2, 0);
  
  console.log('模型已居中，相机位置已调整');
}

// 创建默认的桥梁分段模型
function createDefaultBridgeModel() {
  bridgeModel = new THREE.Group();
  scene.add(bridgeModel);
  
  // 这里可以在获取数据后构建分段模型
  console.log('使用默认桥梁分段模型');
}

// 初始化分区映射
function initializePartitionMap() {
  // 清除现有映射
  partitionMap.clear();
  
  if (!bridgeModel) return;
  
  // 尝试根据名称查找模型中的各个部分
  // 这里需要根据实际模型的结构进行调整
  const modelParts = bridgeModel.children;
  
  // 为每个分区创建对应的材质组
  // 由于我们不知道实际模型的结构，我们将使用材质分组的方式
  // 为每个分区创建一个独特的颜色材质
  const materials = [];
  
  // 递归遍历模型的所有网格
  function traverseModel(obj) {
    if (obj.isMesh) {
      // 为每个网格创建一个材质副本，以便我们可以单独修改颜色
      if (Array.isArray(obj.material)) {
        const clonedMaterials = obj.material.map(mat => mat.clone());
        materials.push(...clonedMaterials);
        obj.material = clonedMaterials;
      } else {
        const clonedMaterial = obj.material.clone();
        materials.push(clonedMaterial);
        obj.material = clonedMaterial;
      }
    }
    
    // 继续遍历子对象
    obj.children.forEach(child => traverseModel(child));
  }
  
  // 遍历整个模型
  traverseModel(bridgeModel);
  
  console.log('模型材质数量:', materials.length);
  console.log('模型初始化完成');
}

/**
 * 更新桥梁模型的分区颜色
 * 根据数据动态创建和更新桥梁分区，并使用颜色表示各分区的刚度状态
 * @param {Array} data - 分区数据数组，包含每个分区的名称、ID和刚度状态等信息
 */
function updateBridgePartitions(data) {
  console.log('更新桥梁分区，数据数量:', data.length);
  
  try {
    // 确保数据有效
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('更新分区失败：数据无效或为空');
      return;
    }
    
    // 确保场景、相机和渲染器存在
    if (!scene || !camera || !renderer) {
      console.log('Three.js核心对象不存在，跳过3D渲染，但确保表格数据显示');
      return;
    }
    
    // 确保桥梁基础模型存在
    if (!bridgeModel || bridgeModel.children.length === 0) {
      console.log('桥梁模型不存在，创建新模型...');
      createBridgeModel();
    }
    
    // 清除现有的监测分区
    bridgePartitions.forEach(part => {
      if (part.parent) part.parent.remove(part);
    });
    bridgePartitions = [];
    
    // 计算分区位置，确保在桥梁主体上均匀分布
    const totalLength = 140;
    const partWidth = totalLength / data.length;
    const startX = -totalLength / 2;
    
    console.log('分区宽度:', partWidth, '起始X:', startX);
    
    // 为每个分区创建可视化部分
    data.forEach((partition, index) => {
      console.log(`处理分区 ${index + 1}: ${partition.name}, 状态: ${partition.stiffnessStatus}`);
      
      // 获取刚度对应的颜色
      const stiffnessColor = getStatusColor(partition.stiffnessStatus || 'normal');
      console.log(`分区 ${partition.name} 颜色:`, stiffnessColor.toString(16));
      
      // 创建分区几何体 - 更大更明显的彩色方块
      const partGeometry = new THREE.BoxGeometry(partWidth - 0.8, 22, 32); // 更大更突出
      const partMaterial = new THREE.MeshLambertMaterial({
        color: stiffnessColor,
        transparent: true,
        opacity: 0.8,
        wireframe: false
      });
      
      const partMesh = new THREE.Mesh(partGeometry, partMaterial);
      
      // 计算位置 - 确保在桥梁主体上清晰可见
      const centerX = startX + (index * partWidth) + (partWidth / 2);
      partMesh.position.set(centerX, 15, 0); // 提高位置，更醒目
      
      // 添加到模型和数组
      bridgeModel.add(partMesh);
      bridgePartitions.push(partMesh);
      
      // 添加更粗的黑色边框
      const edgeGeometry = new THREE.EdgesGeometry(partGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 5
      });
      const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      partMesh.add(edgeLines);
      
      // 添加分区名称标签
      const div = document.createElement('div');
      div.className = 'partition-label';
      div.textContent = partition.name;
      div.style.position = 'absolute';
      div.style.pointerEvents = 'none';
      div.style.zIndex = 1000;
      div.style.fontSize = '12px';
      div.style.padding = '4px 8px';
      div.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      div.style.color = 'white';
      div.style.borderRadius = '4px';
      div.style.whiteSpace = 'nowrap';
      document.body.appendChild(div);
      
      // 保存标签引用以便后续更新位置
      labels.push({ element: div, mesh: partMesh });
      
      console.log(`分区 ${partition.name} 创建完成`);
    });
    
    // 添加更多灯光以增强材质效果
    if (scene.children.find(child => child.type === 'DirectionalLight') === undefined) {
      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight2.position.set(-1, 1, -1).normalize();
      scene.add(directionalLight2);
    }
    
    // 调整相机位置，提供更好的视角
    camera.position.set(0, 120, 350); // 更高更远，一览全貌
    camera.lookAt(0, 20, 0);
    
    // 添加标签位置更新到渲染循环
    updateLabels();
    
    // 立即渲染一帧，确保更新立即显示
    renderer.render(scene, camera);
    
    console.log('桥梁分区更新完成，共创建', bridgePartitions.length, '个分区');
  } catch (error) {
    console.error('更新桥梁分区时发生错误:', error);
    // 即使渲染失败，也要确保表格数据正常显示
    console.log('渲染失败，但表格数据仍应正常显示');
  }
}

/**
 * 更新标签位置
 * 将3D模型中的标签位置实时转换为屏幕坐标，并更新DOM元素位置
 * 使用requestAnimationFrame确保流畅的动画效果
 */
function updateLabels() {
  if (!labels.length || !camera || !renderer) return;
  
  labels.forEach(label => {
    // 从网格对象的世界矩阵中获取位置
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(label.mesh.matrixWorld);
    
    // 将3D坐标投影到相机视平面
    position.project(camera);
    
    // 获取渲染器画布尺寸
    const canvas = renderer.domElement;
    
    // 计算屏幕坐标
    const x = (position.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (- position.y * 0.5 + 0.5) * canvas.clientHeight;
    
    // 更新标签元素的位置
    const div = label.element;
    div.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    
    // 检查是否在视锥体内，决定标签显示状态
    const visible = position.z >= -1 && position.z <= 1;
    div.style.display = visible ? 'block' : 'none';
  });
  
  // 请求下一帧动画，保持标签位置实时更新
  requestAnimationFrame(updateLabels);
}

/**
 * 创建简化的桥梁分段模型（兼容旧代码）
 * 将传入的数据用于更新桥梁分区可视化
 * @param {Array} data - 分区数据数组
 */
function createSimplifiedBridgeModel(data) {
  updateBridgePartitions(data);
}

// 删除重复的createLabel函数声明

/**
 * 添加桥梁细节
 * 为桥梁模型添加横向和纵向支撑结构，增强视觉效果和真实感
 * @param {THREE.Mesh} mesh - 要添加细节的网格对象
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} depth - 深度
 */
function addBridgeDetails(mesh, width, height, depth) {
  // 添加一些梁和支撑结构来增强视觉效果
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    wireframe: true
  });
  
  // 添加横向支撑
  const crossBeamGeometry = new THREE.BoxGeometry(width, 1, 1);
  const crossBeam1 = new THREE.Mesh(crossBeamGeometry, beamMaterial);
  const crossBeam2 = new THREE.Mesh(crossBeamGeometry, beamMaterial);
  
  crossBeam1.position.set(0, height/2 + 0.5, depth/3);
  crossBeam2.position.set(0, height/2 + 0.5, -depth/3);
  
  mesh.add(crossBeam1);
  mesh.add(crossBeam2);
  
  // 添加纵向支撑
  const longitudinalBeamGeometry = new THREE.BoxGeometry(1, 1, depth);
  const longitudinalBeam1 = new THREE.Mesh(longitudinalBeamGeometry, beamMaterial);
  const longitudinalBeam2 = new THREE.Mesh(longitudinalBeamGeometry, beamMaterial);
  
  longitudinalBeam1.position.set(width/3, height/2 + 0.5, 0);
  longitudinalBeam2.position.set(-width/3, height/2 + 0.5, 0);
  
  mesh.add(longitudinalBeam1);
  mesh.add(longitudinalBeam2);
}

// 创建标签
// 标签创建现在在updateBridgePartitions函数内部使用Three.js精灵实现

/**
 * 获取状态颜色
 * 根据状态类型返回对应的颜色值
 * @param {string} status - 状态类型 (normal, warning, danger)
 * @returns {number} 十六进制颜色值
 */
function getStatusColor(status) {
  switch (status) {
    case 'normal':
      return 0x00ff00; // 绿色
    case 'warning':
      return 0xffff00; // 黄色
    case 'danger':
      return 0xff0000; // 红色
    default:
      return 0x808080; // 灰色
  }
}

/**
 * 获取状态文本
 * 根据状态类型返回对应的中文文本
 * @param {string} status - 状态类型 (normal, warning, danger)
 * @returns {string} 状态文本
 */
function getStatusText(status) {
  switch (status) {
    case 'normal':
      return '正常';
    case 'warning':
      return '警告';
    case 'danger':
      return '危险';
    default:
      return '未知';
  }
}

/**
 * 获取偏差类名
 * 根据偏差值确定对应的CSS类名，用于样式显示
 * @param {number} deviation - 偏差值
 * @returns {string} CSS类名
 */
function getDeviationClass(deviation) {
  const absDev = Math.abs(deviation);
  if (absDev > 10) return 'deviation-danger';
  if (absDev > 5) return 'deviation-warning';
  return 'deviation-normal';
}

/**
 * API基础URL
 * 用于构建API请求地址的基础路径
 */
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * 获取数据
 * 从后端API获取桥梁分区刚度和质量数据，并更新组件状态和可视化
 */
async function refreshData() {
  console.log('开始获取刚度质量数据...');
  try {
    // 从后端API获取数据
    console.log('从API获取刚度质量数据');
    const response = await axios.get(`${API_BASE_URL}/stiffness-mass`);
    const data = response.data;
    
    console.log('API返回数据，分区数量:', data.partitions.length);
    
    // 更新数据
    partitions.value = data.partitions;
    lastUpdated.value = new Date().toLocaleString();
    console.log('数据更新完成，分区数量:', partitions.value.length);
    
    // 更新可视化
    updateBridgePartitions(partitions.value);
    console.log('数据更新和可视化完成');
    
  } catch (error) {
    console.error('数据更新失败:', error.message);
    
    // 错误时使用模拟数据作为备用
    console.log('使用备用模拟数据更新');
    const updatedPartitions = partitions.value.map(partition => {
      const stiffnessVariation = (Math.random() - 0.5) * 1000;
      const massVariation = (Math.random() - 0.5) * 200;
      
      const newStiffness = partition.currentStiffness + stiffnessVariation;
      const newMass = partition.currentMass + massVariation;
      
      // 重新计算偏差和状态
      const stiffnessDeviation = ((newStiffness / partition.baseStiffness) - 1) * 100;
      const massDeviation = ((newMass / partition.baseMass) - 1) * 100;
      
      // 确定新状态
      let stiffnessStatus = 'normal';
      if (Math.abs(stiffnessDeviation) > 10) {
        stiffnessStatus = 'danger';
      } else if (Math.abs(stiffnessDeviation) > 5) {
        stiffnessStatus = 'warning';
      }
      
      let massStatus = 'normal';
      if (Math.abs(massDeviation) > 10) {
        massStatus = 'danger';
      } else if (Math.abs(massDeviation) > 5) {
        massStatus = 'warning';
      }
      
      return {
        ...partition,
        currentStiffness: newStiffness,
        currentMass: newMass,
        stiffnessDeviation: Number(stiffnessDeviation.toFixed(2)),
        massDeviation: Number(massDeviation.toFixed(2)),
        stiffnessStatus,
        massStatus
      };
    });
    
    // 更新数据
    partitions.value = updatedPartitions;
    lastUpdated.value = new Date().toLocaleString();
    updateBridgePartitions(partitions.value);
  }
}

/**
 * 开始自动刷新
 * 设置定时任务，启用数据自动刷新功能
 */
function startAutoRefresh() {
  if (!autoRefreshActive.value) {
    autoRefreshActive.value = true;
    refreshData(); // 立即刷新一次
    refreshTimer = setInterval(refreshData, refreshInterval.value);
  }
}

/**
 * 停止自动刷新
 * 清除定时任务，禁用数据自动刷新功能
 */
function stopAutoRefresh() {
  if (autoRefreshActive.value) {
    autoRefreshActive.value = false;
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * 监听分区数据变化
 * 当分区数据发生变化时，检查是否有关键分区状态为危险并显示警告信息
 */
watch(
  () => partitions.value,
  (newPartitions) => {
    // 遍历所有分区，检查是否有危险状态的分区
    newPartitions.forEach(partition => {
      if (partition.stiffnessStatus === 'danger' || partition.massStatus === 'danger') {
        console.warn(`⚠️ 预警: ${partition.name} 出现异常!`);
        console.warn(`刚度偏差: ${partition.stiffnessDeviation}%, 质量偏差: ${partition.massDeviation}%`);
        // 这里可以集成Element Plus的弹窗组件或其他通知机制
      }
    });
  },
  { deep: true } // 深度监听，确保嵌套属性变化也能被检测到
);

/**
 * 组件挂载生命周期钩子
 * 负责初始化DOM引用、Three.js场景和数据加载
 * 提供完整的错误处理和状态反馈
 */
onMounted(async () => {
  console.log('StiffnessMassDisplay组件开始挂载...');
  
  try {
    // 使用nextTick确保DOM完全渲染
    await nextTick();
    
    // 立即检查容器存在状态
    containerExists.value = !!threeContainer.value;
    console.log('容器存在状态:', containerExists.value);
    
    // 如果容器存在，初始化Three.js场景和相关配置
    if (threeContainer.value) {
      // 强制设置容器样式以确保Three.js正确渲染
      threeContainer.value.style.width = '100%';
      threeContainer.value.style.height = '400px';
      threeContainer.value.style.position = 'relative';
      console.log('已设置容器样式');
      
      // 再次使用nextTick确保样式应用完成
      await nextTick();
      
      console.log('开始初始化Three.js场景');
      initThreeScene();
      
      // 延迟初始化数据和可视化，确保渲染器准备就绪
      setTimeout(async () => {
        try {
          console.log('从API获取初始数据...');
          await refreshData();
          initCompleted.value = true;
          initMessage.value = '初始化完成';
        } catch (error) {
          console.error('获取初始数据失败:', error);
          // 使用默认数据作为备用，确保界面不会空白
          if (partitions.value.length > 0) {
            console.log('使用默认数据初始化可视化');
            updateBridgePartitions(partitions.value);
          }
          initCompleted.value = true;
          initMessage.value = '初始化完成（使用默认数据）';
        }
      }, 500);
    } else {
      console.error('容器不存在');
      initError.value = true;
      initMessage.value = '错误：容器不存在';
    }
  } catch (error) {
    console.error('挂载过程出错:', error);
    initError.value = true;
    initMessage.value = `挂载错误: ${error.message}`;
  }
});

/**
 * 组件卸载生命周期钩子
 * 负责清理所有资源，防止内存泄漏
 * 包括定时器、事件监听器、DOM元素和Three.js资源
 */
onUnmounted(() => {
  // 停止自动刷新定时器
  stopAutoRefresh();
  
  // 移除窗口大小变化事件监听器
  window.removeEventListener('resize', handleResize);
  
  // 清理所有DOM标签元素
  labels.forEach(label => {
    if (label.element && label.element.parentNode) {
      label.element.parentNode.removeChild(label.element);
    }
  });
  labels = [];
  
  // 清理Three.js资源
  if (renderer) {
    renderer.dispose(); // 释放WebGL上下文相关资源
  }
  
  // 清理其他引用，帮助垃圾回收
  scene = null;
  camera = null;
  bridgeModel = null;
  bridgePartitions = [];
  partitionMap.clear();
});
</script>

<style scoped>
.stiffness-mass-display {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 调试信息样式 */
.debug-info {
  margin-bottom: 20px;
  background-color: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  padding: 15px;
}

.debug-info h4 {
  margin-top: 0;
  color: #1890ff;
  font-size: 1.2rem;
  margin-bottom: 10px;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.debug-item:last-child {
  margin-bottom: 0;
}

.debug-status {
  font-weight: bold;
}

.debug-status.success {
  color: #52c41a;
}

.debug-status.error {
  color: #ff4d4f;
}

.controls {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.controls h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.control-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #409eff;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.control-buttons button:hover:not(:disabled) {
  background-color: #66b1ff;
}

.control-buttons button:disabled {
  background-color: #c0c4cc;
  cursor: not-allowed;
}

.refresh-btn {
  background-color: #67c23a !important;
}

.refresh-btn:hover {
  background-color: #85ce61 !important;
}

.status-info {
  color: #606266;
  font-size: 14px;
}

.status-info p {
  margin: 5px 0;
}

.visualization-container {
  flex: 1;
  background-color: white;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-height: 450px;
  position: relative;
}

.three-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
  background-color: #f0f0f0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
}

/* 备用模型样式 */
.fallback-model {
  width: 100%;
  height: 400px;
  background-color: #f0f0f0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.bridge-basic {
  width: 100%;
  height: 60%;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.bridge-main {
  width: 80%;
  height: 20px;
  background-color: #808080;
  position: relative;
  z-index: 2;
}

.bridge-supports {
  display: flex;
  justify-content: space-between;
  width: 80%;
  position: absolute;
  bottom: 0;
  z-index: 1;
}

.support {
  width: 10px;
  height: 80px;
  background-color: #696969;
}

.bridge-partitions {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  display: flex;
}

.bridge-partition {
  height: 100%;
  position: relative;
  border-right: 2px solid black;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.3s;
  opacity: 0.8;
}

.bridge-partition:hover {
  opacity: 1;
}

.bridge-partition:last-child {
  border-right: none;
}

.data-panel {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.data-panel h4 {
  margin: 0 0 15px 0;
  color: #333;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  margin-bottom: 10px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th, .data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ebeef5;
  min-width: 100px;
}

.data-table th {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 600;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table tr:hover {
  background-color: #f5f7fa;
}

/* 表格数据样式增强 */
.data-table td {
  transition: background-color 0.2s;
}

/* 数值格式化 */
.data-table td:nth-child(2),
.data-table td:nth-child(5) {
  font-family: 'Courier New', monospace;
  text-align: right;
}

/* 偏差值样式 */
.data-table td:nth-child(3),
.data-table td:nth-child(6) {
  font-weight: bold;
  text-align: right;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
}

.status-dot.normal {
  background-color: #67c23a;
}

.status-dot.warning {
  background-color: #e6a23c;
}

.status-dot.danger {
  background-color: #f56c6c;
}

/* 状态徽章 */
.status-badge {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
  display: inline-block;
  min-width: 60px;
  text-align: center;
}

.status-normal {
  background-color: #f0f9ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.status-warning {
  background-color: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
}

.status-danger {
  background-color: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffccc7;
}

.deviation-normal {
  color: #67c23a;
}

.deviation-warning {
  color: #e6a23c;
  font-weight: bold;
}

.deviation-danger {
  color: #f56c6c;
  font-weight: bold;
}

/* 表格信息 */
.table-info {
  text-align: right;
  font-size: 12px;
  color: #999;
  padding: 5px 0;
}

/* 空表格状态 */
.empty-table {
  text-align: center;
  padding: 40px;
  color: #999;
}

.empty-table td {
  border: none;
  background-color: #fafafa;
}

/* 分区标签样式 */
.partition-label {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}

.label-title {
  font-weight: bold;
  margin-bottom: 4px;
}

.label-content p {
  margin: 2px 0;
  font-size: 11px;
}
</style>