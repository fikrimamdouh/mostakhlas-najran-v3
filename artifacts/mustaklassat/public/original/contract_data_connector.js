/**
 * contract_data_connector.js
 * ملف موحد لعرض وربط بيانات العقد والمستخلص بين الصفحات.
 * يحافظ على نفس مفاتيح التخزين ونفس أسماء الدوال المستخدمة في الصفحات.
 */

function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error loading from local