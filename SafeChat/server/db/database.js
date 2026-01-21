const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

class JSONDB {
  constructor(filename) {
    this.file = path.join(DATA_DIR, filename);
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '[]');
  }

  read() {
    try {
      const content = fs.readFileSync(this.file, 'utf8');
      if (!content || content.trim() === '') {
        return [];
      }
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading database file ${this.file}:`, error);
      return [];
    }
  }

  write(data) {
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2));
  }

  find(query = {}) {
    const data = this.read();
    return data.filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  findOne(query = {}) {
    const data = this.read();
    return data.find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  create(item) {
    const data = this.read();
    const newItem = { _id: uuidv4(), createdAt: new Date(), ...item };
    data.push(newItem);
    this.write(data);
    return newItem;
  }

  update(id, updates) {
    const data = this.read();
    const index = data.findIndex(item => item._id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      this.write(data);
      return data[index];
    }
    return null;
  }

  delete(id) {
    let data = this.read();
    const initialLength = data.length;
    data = data.filter(item => item._id !== id);
    if (data.length !== initialLength) {
      this.write(data);
      return true;
    }
    return false;
  }
}

module.exports = {
  users: new JSONDB('users.json'),
  messages: new JSONDB('messages.json'),
  channels: new JSONDB('channels.json')
};