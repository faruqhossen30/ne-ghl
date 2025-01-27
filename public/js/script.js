const socket = io();

const sendButton = document.getElementById('sendButton');
const inputTag = document.getElementById('inputTag');


sendButton.addEventListener('click', function () {
        if (inputTag.value) {
                socket.emit('chats', inputTag.value);
                inputTag.value = '';
        }
})