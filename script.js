async function enviarNotificacao(item, atual) {
    const payload = {
        _subject: `FinNotes: Pagamento Confirmado - ${item.nome}`,
        item: item.nome,
        parcela: `${atual} de ${item.parcelas}`,
        valor: `R$ ${item.total.toFixed(2)}`,
        data: new Date().toLocaleString('pt-BR')
    };

    console.log("Tentando enviar e-mail para:", getM()); // Debug no F12

    try {
        const response = await fetch(`https://formsubmit.co/ajax/${getM()}`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if(data.success === "false" && data.message.includes("Activation")) {
            alert("AVISO: Verifique seu e-mail " + getM() + " e clique no botão de ativação do FormSubmit para começar a receber as notificações.");
            addLog("Aguardando ativação do FormSubmit.");
        } else {
            addLog("Notificação enviada com sucesso.");
        }
    } catch (e) {
        console.error("Erro de rede:", e);
        addLog("Erro de rede: Sem conexão com servidor de e-mail.");
    }
}
