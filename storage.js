/**
 * PRO-GRADE ENTERPRISE STORAGE HUB (IndexedDB Wrapper)
 * Designed to handle millions of transactions without UI lag.
 */
class EnterpriseStorage {
    constructor() {
        this.dbName = 'AccuProcessProDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject('Database error');
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('company_data')) {
                    db.createObjectStore('company_data', { keyPath: 'id' });
                }
            };
        });
    }

    async saveData(userId, companyId, data) {
        if (!this.db) await this.init();
        const key = `${userId}_${companyId}`;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('company_data', 'readwrite');
            const store = tx.objectStore('company_data');
            store.put({ id: key, data, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject('Save failed');
        });
    }

    async getData(userId, companyId) {
        if (!this.db) await this.init();
        const key = `${userId}_${companyId}`;
        return new Promise((resolve) => {
            const tx = this.db.transaction('company_data', 'readonly');
            const store = tx.objectStore('company_data');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => resolve(null);
        });
    }

    async deleteData(userId, companyId) {
        if (!this.db) await this.init();
        const key = `${userId}_${companyId}`;
        const tx = this.db.transaction('company_data', 'readwrite');
        tx.objectStore('company_data').delete(key);
    }
}

window.StorageHub = new EnterpriseStorage();
