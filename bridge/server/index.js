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
    { position: { x: -20, y: 0, z: 0 }, value: 0.4, name: '应力点1' },
    { position: { x: 0, y: 0, z: 0 }, value: 0.6, name: '应力点2' },
    { position: { x: 20, y: 0, z: 0 }, value: 0.5, name: '应力点3' }
  ],
  lastUpdated: new Date().toISOString()
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

// 修复字符串模板语法
app.listen(PORT, () => {
  console.log(`桥梁监测后端服务运行在 http://localhost:${PORT}`);
  console.log('API端点:');
  console.log(`  - 获取当前数据: GET http://localhost:${PORT}/api/bridge-data`);
  console.log(`  - 获取最新数据: GET http://localhost:${PORT}/api/bridge-data/latest`);
});