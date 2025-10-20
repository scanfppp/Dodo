// 添加express导入
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors());
app.use(express.json());

// 生成30个传感器测点数据（每侧15个）的函数
function generateSensorPoints() {
  const stressPoints = [];
  const totalLength = 180; // 总桥长，与前端保持一致
  const bridgeWidth = 8.8; // 桥宽，与前端保持一致
  const pointsPerSide = 15; // 每侧的点数
  const xSpacing = totalLength / (pointsPerSide - 1); // 长度方向间隔
  const baseHeight = 22; // 桥面Y坐标，与前端保持一致

  // 生成左侧15个测点
  for (let i = 0; i < pointsPerSide; i++) {
    const x = -totalLength / 2 + i * xSpacing;
    const y = baseHeight + 0.8;
    const z = -bridgeWidth / 2;

    stressPoints.push({
      id: i + 1,
      position: { x, y, z },
      value: Math.random() * 0.4 + 0.2, // 随机应力值0.2-0.6
      name: `左侧测点${i + 1}`,
      sensorType: 'displacement', // 位移传感器
      measuredDirections: ['x', 'y', 'z'] // X、Y、Z三个方向
    });
  }

  // 生成右侧15个测点
  for (let i = 0; i < pointsPerSide; i++) {
    const x = -totalLength / 2 + i * xSpacing;
    const y = baseHeight + 0.8;
    const z = bridgeWidth / 2;

    stressPoints.push({
      id: i + pointsPerSide + 1,
      position: { x, y, z },
      value: Math.random() * 0.4 + 0.2, // 随机应力值0.2-0.6
      name: `右侧测点${i + 1}`,
      sensorType: 'displacement', // 位移传感器
      measuredDirections: ['x', 'y', 'z'] // X、Y、Z三个方向
    });
  }

  return stressPoints;
}

// 模拟数据库中的桥梁数据
let bridgeData = {
  status: 'normal', // normal, warning, danger
  temperature: 25, // 摄氏度
  vibration: 0.3, // 振幅
  stressPoints: generateSensorPoints(), // 生成30个测点数据
  lastUpdated: new Date().toISOString()
};

// 生成随机变化的桥梁数据函数
function generateRandomData() {
  // 创建新数据对象，基于现有数据
  const newData = JSON.parse(JSON.stringify(bridgeData));
  
  // 随机调整温度（上下1度）
  newData.temperature = Math.round((newData.temperature + (Math.random() - 0.5) * 2) * 10) / 10;
  
  // 随机调整振动值（0-0.5之间）
  newData.vibration = Math.round((Math.random() * 0.5) * 100) / 100;
  
  // 更新每个应力点的值，让它们动态变化
  let totalStress = 0;
  newData.stressPoints.forEach(point => {
    // 在原有值的基础上随机增减，确保在0.2-0.6范围内
    const variation = (Math.random() - 0.5) * 0.2; // ±0.1的变化范围
    let newValue = point.value + variation;
    
    // 确保值在有效范围内
    if (newValue < 0.2) newValue = 0.2;
    if (newValue > 0.6) newValue = 0.6;
    
    point.value = Math.round(newValue * 100) / 100; // 保留两位小数
    totalStress += point.value;
  });
  
  // 计算平均应力值
  const avgStress = totalStress / newData.stressPoints.length;
  
  // 根据平均应力值更新状态
  if (avgStress > 0.5) {
    newData.status = 'warning';
  } else {
    newData.status = 'normal';
  }
  
  // 更新时间戳
  newData.lastUpdated = new Date().toISOString();
  
  return newData;
}

// 模态分析数据
const modalAnalysisData = {
  modes: [
    {
      order: 1,
      frequency: 2.35,
      damping: 0.52,
      confidence: 0.985,
      deformationPatterns: [0.1, 0.3, 0.5, 0.3, 0.1]
    },
    {
      order: 2,
      frequency: 5.12,
      damping: 0.48,
      confidence: 0.978,
      deformationPatterns: [0.2, 0.5, 0.8, 0.5, 0.2]
    },
    {
      order: 3,
      frequency: 8.76,
      damping: 0.45,
      confidence: 0.962,
      deformationPatterns: [0.3, 0.6, 0.9, 0.6, 0.3]
    },
    {
      order: 4,
      frequency: 12.43,
      damping: 0.42,
      confidence: 0.941,
      deformationPatterns: [0.4, 0.7, 1.0, 0.7, 0.4]
    },
    {
      order: 5,
      frequency: 16.89,
      damping: 0.38,
      confidence: 0.927,
      deformationPatterns: [0.5, 0.8, 1.1, 0.8, 0.5]
    },
    {
      order: 6,
      frequency: 21.34,
      damping: 0.35,
      confidence: 0.912,
      deformationPatterns: [0.6, 0.9, 1.2, 0.9, 0.6]
    }
  ],
  stiffnessData: [
    { section: '左侧支座', stiffness: 98.5, mass: 102.3 },
    { section: '左侧桥跨', stiffness: 92.1, mass: 95.6 },
    { section: '中间跨', stiffness: 94.8, mass: 97.2 },
    { section: '右侧桥跨', stiffness: 91.5, mass: 96.8 },
    { section: '右侧支座', stiffness: 97.3, mass: 101.5 }
  ]
};

// 生成随机模拟数据的函数
function generateRandomData() {
  const newData = JSON.parse(JSON.stringify(bridgeData));

  // 随机更新应力点数据，保持其他属性不变
  newData.stressPoints.forEach(point => {
    // 只更新value属性，保留id、position、name、sensorType和measuredDirections
    point.value = Math.max(-0.9, Math.min(0.9, point.value + (Math.random() - 0.5) * 0.3));
  });

  // 计算平均应力值并更新整体状态
  const avgStress = newData.stressPoints.reduce((sum, point) => sum + point.value, 0) / newData.stressPoints.length;
  if (avgStress > 0.7) {
    newData.status = 'danger';
  } else if (avgStress > 0.5) {
    newData.status = 'warning';
  } else {
    newData.status = 'normal';
  }

  // 更新温度和振动
  newData.temperature += (Math.random() - 0.5) * 2;
  newData.temperature = Math.round(newData.temperature * 10) / 10;
  newData.vibration = Math.max(0.1, Math.min(0.8, newData.vibration + (Math.random() - 0.5) * 0.1));
  newData.vibration = Math.round(newData.vibration * 100) / 100;

  // 更新时间戳
  newData.lastUpdated = new Date().toISOString();

  return newData;
}

// 生成刚度和质量变化数据的函数（9个分区）
function generateStiffnessMassData() {
  // 基准刚度值和质量值（示例值）
  const baseStiffnessValues = [
    25000, 28000, 30000, // 第一跨（左到右）
    32000, 35000, 33000, // 第二跨（左到右）
    31000, 29000, 26000  // 第三跨（左到右）
  ];

  const baseMassValues = [
    12000, 13500, 14000, // 第一跨（左到右）
    15000, 16000, 15500, // 第二跨（左到右）
    14500, 13000, 12500  // 第三跨（左到右）
  ];

  const sections = [
    { name: '第一跨左侧', position: { start: { x: -90, z: -4.4 }, end: { x: -60, z: 4.4 } } },
    { name: '第一跨中部', position: { start: { x: -60, z: -4.4 }, end: { x: -30, z: 4.4 } } },
    { name: '第一跨右侧', position: { start: { x: -30, z: -4.4 }, end: { x: 0, z: 4.4 } } },
    { name: '第二跨左侧', position: { start: { x: 0, z: -4.4 }, end: { x: 30, z: 4.4 } } },
    { name: '第二跨中部', position: { start: { x: 30, z: -4.4 }, end: { x: 60, z: 4.4 } } },
    { name: '第二跨右侧', position: { start: { x: 60, z: -4.4 }, end: { x: 90, z: 4.4 } } },
    { name: '第三跨左侧', position: { start: { x: 90, z: -4.4 }, end: { x: 120, z: 4.4 } } },
    { name: '第三跨中部', position: { start: { x: 120, z: -4.4 }, end: { x: 150, z: 4.4 } } },
    { name: '第三跨右侧', position: { start: { x: 150, z: -4.4 }, end: { x: 180, z: 4.4 } } }
  ];

  // 确保每个请求都有明显的数据变化
  // 设置一些分区为正常，一些为警告，一些为危险，以展示完整的颜色效果
  const statusDistribution = [
    Math.random() > 0.7 ? 'danger' : (Math.random() > 0.5 ? 'warning' : 'normal'), // 第一跨左侧
    Math.random() > 0.8 ? 'danger' : (Math.random() > 0.6 ? 'warning' : 'normal'), // 第一跨中部
    Math.random() > 0.7 ? 'danger' : (Math.random() > 0.5 ? 'warning' : 'normal'), // 第一跨右侧
    Math.random() > 0.6 ? 'danger' : (Math.random() > 0.4 ? 'warning' : 'normal'), // 第二跨左侧
    Math.random() > 0.5 ? 'danger' : (Math.random() > 0.3 ? 'warning' : 'normal'), // 第二跨中部（重点监测）
    Math.random() > 0.6 ? 'danger' : (Math.random() > 0.4 ? 'warning' : 'normal'), // 第二跨右侧
    Math.random() > 0.7 ? 'danger' : (Math.random() > 0.5 ? 'warning' : 'normal'), // 第三跨左侧
    Math.random() > 0.8 ? 'danger' : (Math.random() > 0.6 ? 'warning' : 'normal'), // 第三跨中部
    Math.random() > 0.7 ? 'danger' : (Math.random() > 0.5 ? 'warning' : 'normal')  // 第三跨右侧
  ];

  const partitionData = sections.map((section, index) => {
    // 根据预设状态生成对应的变化率
    let stiffnessChangeRate, massChangeRate;
    const targetStatus = statusDistribution[index];
    
    switch(targetStatus) {
      case 'danger':
        // 危险状态：刚度下降10-20%，质量变化±12%内
        stiffnessChangeRate = -0.1 - Math.random() * 0.1; // -10% 到 -20%
        massChangeRate = (Math.random() - 0.5) * 0.24; // -12% 到 12%
        break;
      case 'warning':
        // 警告状态：刚度下降5-10%，质量变化±8%内
        stiffnessChangeRate = -0.05 - Math.random() * 0.05; // -5% 到 -10%
        massChangeRate = (Math.random() - 0.5) * 0.16; // -8% 到 8%
        break;
      default:
        // 正常状态：刚度变化±5%内，质量变化±5%内
        stiffnessChangeRate = (Math.random() - 0.5) * 0.1; // -5% 到 5%
        massChangeRate = (Math.random() - 0.5) * 0.1; // -5% 到 5%
    }

    // 计算当前值
    const currentStiffness = Math.round(baseStiffnessValues[index] * (1 + stiffnessChangeRate));
    const currentMass = Math.round(baseMassValues[index] * (1 + massChangeRate));

    // 计算偏差率百分比
    const stiffnessDeviation = parseFloat((stiffnessChangeRate * 100).toFixed(2));
    const massDeviation = parseFloat((massChangeRate * 100).toFixed(2));

    // 确定状态（根据偏差率）
    let stiffnessStatus = 'normal';
    let massStatus = 'normal';

    const absStiffnessDev = Math.abs(stiffnessDeviation);
    const absMassDev = Math.abs(massDeviation);

    if (absStiffnessDev > 10) {
      stiffnessStatus = 'danger';
    } else if (absStiffnessDev > 5) {
      stiffnessStatus = 'warning';
    }

    if (absMassDev > 10) {
      massStatus = 'danger';
    } else if (absMassDev > 5) {
      massStatus = 'warning';
    }

    return {
      id: index + 1,
      name: section.name,
      position: section.position,
      baseStiffness: baseStiffnessValues[index],
      currentStiffness: currentStiffness,
      stiffnessDeviation: stiffnessDeviation,
      stiffnessStatus: stiffnessStatus,
      baseMass: baseMassValues[index],
      currentMass: currentMass,
      massDeviation: massDeviation,
      massStatus: massStatus,
      timestamp: new Date().toISOString()
    };
  });

  return {
    partitions: partitionData,
    lastUpdated: new Date().toISOString()
  };
}

// 生成频率响应函数数据的函数
function generateFrequencyData(sensorId) {
  // 生成62个传感器（文档要求62个加速度传感器）
  const totalSensors = 62;

  // 验证sensorId是否有效
  if (!sensorId || sensorId < 1 || sensorId > totalSensors) {
    sensorId = 1;
  }

  // 生成频率轴数据（0-50Hz，间隔0.1Hz）
  const frequencies = [];
  const psdValues = [];

  // 模态频率点（根据文档示例）
  const modalFrequencies = [3.929, 4.034, 6.521, 8.123, 10.456, 12.789, 15.234, 18.765];
  const modalPeaks = [];

  // 生成频率响应数据
  for (let freq = 0; freq <= 500; freq++) {
    const frequency = freq * 0.1;
    frequencies.push(frequency);

    // 基础噪声
    let psdValue = 0.01 + Math.random() * 0.005;

    // 为每个模态频率添加峰值
    modalFrequencies.forEach((modalFreq, index) => {
      // 高斯分布生成峰值，使峰值在模态频率附近
      const distance = frequency - modalFreq;
      const peakAmplitude = 0.5 + Math.random() * 0.3; // 峰值振幅
      const peakWidth = 0.2; // 峰值宽度

      // 根据传感器ID调整峰值强度
      const sensorFactor = 0.5 + (sensorId / totalSensors) * 0.5;

      // 添加高斯峰值
      psdValue += (peakAmplitude * sensorFactor) * Math.exp(-(distance * distance) / (2 * peakWidth * peakWidth));

      // 记录模态峰值点
      if (Math.abs(distance) < 0.05) {
        modalPeaks.push({
          frequency: modalFreq,
          amplitude: psdValue,
          modeIndex: index + 1
        });
      }
    });

    // 添加一些共振峰
    if (frequency > 2) {
      psdValue += 0.02 * Math.sin(frequency * 0.5) * Math.exp(-frequency / 20);
    }

    psdValues.push(psdValue);
  }

  // 去重模态峰值
  const uniquePeaks = modalPeaks.filter((peak, index, self) =>
    index === self.findIndex(p => Math.abs(p.frequency - peak.frequency) < 0.1)
  );

  return {
    sensorId: sensorId,
    sensorName: `加速度传感器${sensorId}`,
    frequencies: frequencies,
    psdValues: psdValues,
    modalPeaks: uniquePeaks,
    timestamp: new Date().toISOString()
  };
}

// API路由
app.get('/api/stiffness-mass', (req, res) => {
  const stiffnessMassData = generateStiffnessMassData();
  res.json(stiffnessMassData);
});

app.get('/api/frequency', (req, res) => {
  const sensorId = parseInt(req.query.sensorId) || 1;
  const frequencyData = generateFrequencyData(sensorId);
  res.json(frequencyData);
});

app.get('/api/bridge-data', (req, res) => {
  // 返回当前数据
  res.json(bridgeData);
});

app.get('/api/bridge-data/latest', (req, res) => {
  // 生成新的随机数据
  const newData = generateRandomData();
  bridgeData = newData;
  res.json(newData);
});

// 获取模态分析数据的API端点
app.get('/api/modal-analysis', (req, res) => {
  res.json(modalAnalysisData);
});

// 获取模态振型数据的API端点
app.get('/api/mode-shape', (req, res) => {
  const modeOrder = parseInt(req.query.mode) || 1;
  const mode = modalAnalysisData.modes.find(m => m.order === modeOrder);

  if (!mode) {
    return res.status(404).json({ error: '指定的模态阶数不存在' });
  }

  // 生成10个节点的变形数据
  const nodes = [];
  const totalLength = 90; // 桥长
  const baseHeight = 15; // 桥面高度

  for (let i = 0; i <= 9; i++) {
    const x = -45 + (i * 9); // 沿桥梁均匀分布节点
    let deformation = 0;

    // 根据模态阶数生成不同的变形模式
    switch (modeOrder) {
      case 1:
        // 第一阶：中间下弯
        deformation = Math.sin((x + 45) / totalLength * Math.PI) * 5;
        break;
      case 2:
        // 第二阶：两端下弯，中间上弯
        deformation = Math.sin((x + 45) / (totalLength / 2) * Math.PI) * 4;
        break;
      case 3:
        // 第三阶：三个波峰波谷
        deformation = Math.sin((x + 45) / (totalLength / 3) * Math.PI) * 3;
        break;
      case 4:
        // 第四阶：四个波峰波谷
        deformation = Math.sin((x + 45) / (totalLength / 4) * Math.PI) * 2.5;
        break;
      case 5:
        // 第五阶：五个波峰波谷
        deformation = Math.sin((x + 45) / (totalLength / 5) * Math.PI) * 2;
        break;
      case 6:
        // 第六阶：六个波峰波谷
        deformation = Math.sin((x + 45) / (totalLength / 6) * Math.PI) * 1.5;
        break;
      default:
        deformation = Math.sin((x + 45) / totalLength * Math.PI * modeOrder) * 2;
    }

    // 为前几阶添加一些水平变形
    const horizontalDeformation = modeOrder > 2 ? Math.cos((x + 45) / totalLength * Math.PI * modeOrder) * 1 : 0;

    nodes.push({
      position: { x, y: baseHeight, z: 0 },
      deformation: {
        x: horizontalDeformation,
        y: -deformation, // Y方向变形（向下为负）
        z: Math.sin((x + 45) / totalLength * Math.PI * modeOrder) * 0.5 // 轻微的Z方向变形
      }
    });
  }

  res.json({
    mode: modeOrder,
    frequency: mode.frequency,
    damping: mode.damping,
    nodes: nodes
  });
});

// 修复字符串模板语法
app.listen(PORT, () => {
  console.log(`桥梁监测后端服务运行在 http://localhost:${PORT}`);
  console.log('API端点:');
  console.log(`  - 获取当前数据: GET http://localhost:${PORT}/api/bridge-data`);
  console.log(`  - 获取最新数据: GET http://localhost:${PORT}/api/bridge-data/latest`);
  console.log(`  - 获取模态分析数据: GET http://localhost:${PORT}/api/modal-analysis`);
  console.log(`  - 获取模态振型数据: GET http://localhost:${PORT}/api/mode-shape?mode=1`);
  console.log(`  - 获取频率响应数据: GET http://localhost:${PORT}/api/frequency?sensorId=1`);
  console.log(`  - 获取刚度质量数据: GET http://localhost:${PORT}/api/stiffness-mass`);
});