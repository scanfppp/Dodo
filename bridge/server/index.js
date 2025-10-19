// 添加express导入
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// 启用CORS
app.use(cors());
app.use(express.json());

// 模拟数据库中的桥梁数据
let bridgeData = {
  status: 'normal', // normal, warning, danger
  temperature: 25, // 摄氏度
  vibration: 0.3, // 振幅
  stressPoints: [
    { position: { x: -22.5, y: 15, z: 0 }, value: 0.52, name: '左侧支座' },
    { position: { x: 22.5, y: 15, z: 0 }, value: 0.54, name: '右侧支座' },
    { position: { x: -45, y: 30, z: 0 }, value: 0.65, name: '左侧桥端' },
    { position: { x: -33.75, y: 30, z: 0 }, value: 0.62, name: '左侧第一跨' },
    { position: { x: -11.25, y: 30, z: 0 }, value: 0.58, name: '中间第一跨' },
    { position: { x: 11.25, y: 30, z: 0 }, value: 0.59, name: '中间第二跨' },
    { position: { x: 33.75, y: 30, z: 0 }, value: 0.63, name: '右侧第一跨' },
    { position: { x: 45, y: 30, z: 0 }, value: 0.66, name: '右侧桥端' }
  ],
  lastUpdated: new Date().toISOString()
};

// 模态分析数据
const modalAnalysisData = {
  modes: [
    {
      frequency: 2.35,
      damping: 0.52,
      confidence: 0.985,
      deformationPatterns: [0.1, 0.3, 0.5, 0.3, 0.1]
    },
    {
      frequency: 5.12,
      damping: 0.48,
      confidence: 0.978,
      deformationPatterns: [0.2, 0.5, 0.8, 0.5, 0.2]
    },
    {
      frequency: 8.76,
      damping: 0.45,
      confidence: 0.962,
      deformationPatterns: [0.3, 0.6, 0.9, 0.6, 0.3]
    },
    {
      frequency: 12.43,
      damping: 0.42,
      confidence: 0.941,
      deformationPatterns: [0.4, 0.7, 1.0, 0.7, 0.4]
    },
    {
      frequency: 16.89,
      damping: 0.38,
      confidence: 0.927,
      deformationPatterns: [0.5, 0.8, 1.1, 0.8, 0.5]
    },
    {
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

  // 随机更新应力点数据
  newData.stressPoints.forEach(point => {
    point.value = Math.max(0.1, Math.min(0.9, point.value + (Math.random() - 0.5) * 0.2));
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

// API路由
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

// 修复字符串模板语法
app.listen(PORT, () => {
  console.log(`桥梁监测后端服务运行在 http://localhost:${PORT}`);
  console.log('API端点:');
  console.log(`  - 获取当前数据: GET http://localhost:${PORT}/api/bridge-data`);
  console.log(`  - 获取最新数据: GET http://localhost:${PORT}/api/bridge-data/latest`);
  console.log(`  - 获取模态分析数据: GET http://localhost:${PORT}/api/modal-analysis`);
});