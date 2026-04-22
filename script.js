function checkLogin() {
    const input = document.getElementById('main-login-pwd');
    // .trim() remove espaços que teclados mobile (Samsung/iPhone) colocam sozinhos
    const senhaDigitada = input.value.trim(); 
    
    // Tenta pegar a senha definida pelo usuário no banco, ou usa a sua senha padrão
    // Substitua '1234' pela sua senha padrão se necessário
    const senhaCorreta = localStorage.getItem('finnotes_password') || '1234';

    if (senhaDigitada === senhaCorreta) {
        // Esconde tela de bloqueio e mostra o app
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        // Garante que o teclado feche no celular
        input.blur(); 
        
        // Inicializa as funções do app (renderização de notas e cálculos)
        if (typeof initApp === 'function') {
            initApp();
        } else if (typeof renderNotes === 'function') {
            renderNotes();
        }
    } else {
        alert("Senha Incorreta!");
        input.value = "";
        input.focus();
    }
}

// Adicione este listener logo abaixo da função para o "Enter" do celular funcionar
document.getElementById('main-login-pwd')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkLogin();
        // Chama permissão de notificação como você configurou no botão do index
        if (typeof requestNotifPermission === 'function') requestNotifPermission();
    }
});
