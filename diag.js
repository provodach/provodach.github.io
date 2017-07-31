var servers = ['provoda.ch', 'api.nyan.pw', 'static.https.cat', 'api.https.cat', 'station.waveradio.org', 'bits.waveradio.org'],

	audios  = [{
			'type' : 'audio/mpeg',
			'file' : 'poison.mp3'
		},
		{
			'type' : 'audio/aac',
			'file' : 'poison.aac'
		},
		{
			'type' : 'audio/ogg',
			'file' : 'poison-he.aac'
		}],

	statuses = {
		'servers' : true,
		'websock' : true,
		'audio'   : true
	},

	player = null,
	playTimer = null,
	loadTimer = null;

function is_mobile()
{
	return (/ipad|ipod|iphone|android/gi.test(navigator.userAgent));
}

function log (message, style)
{
	style = style || 'regular';

	message = message.replace (/\n/g, '<br>');

	$('#log').append ('<span class="'+style+'">'+message+"</span>");

	$(document).scrollTop($(document).height()-$(window).height());
}

function start_test()
{
	$('#start-splash').hide();
	$('#log').show();
	
	window.navigator.oscpu = window.navigator.oscpu || window.navigator.platform;
	log ('Браузер: '+navigator.userAgent+"\n", 'info');
	log ('ОС: '+navigator.oscpu+"\n\n", 'info');

	log ("Начинаю проверку доступности серверов\n", 'info');

	server_test();
}

function server_test()
{
	if (servers.length > 0)
	{
		var server = servers[0];
		servers.shift();

		log ('Проверяю ');
		log (server, 'info');
		log ("... ");

		$.ajax ('https://'+server+'/diagtest')
			.done(function() {
				log ("OK\n", 'ok');
			})
			.fail(function(xhr, error, text) {
				log ('ОТКАЗ: ', 'error');
				log ('Результат '+xhr.readyState+'; Статус '+xhr.status+'; Ошибка '+error+"\n");
				statuses.servers = false;
			})
			.always(function() {
				server_test();
			});
	}
		else
			websocket_test();
}

function websocket_test()
{
	log ("\nПроверяю статус сокетного соединения (чат)\n", 'info');

	if (!('WebSocket' in window))
	{
		log ("Браузер не поддерживает WebSocket!\n", 'error');
		statuses.websock = false;
		audio_test();
	}
		else
	{
		try
		{
			log ("Сокеты поддерживаются, пробую подключиться...\n");
			var sock = new WebSocket('wss://api.nyan.pw:1337');

			sock.onmessage = function (ev) {
				if (ev.data.indexOf ('REM') > -1)
				{
					log ("Сервер сообщил ожидаемые данные, сокет работает\n");
					sock.close();
				}
				else
				{
					log ('Неверные данные от сервера: ', 'error');
					log (ev.data+"\n");
					statuses.websock = false;
					sock.close();
				}
			};


			sock.onclose = function (ev) {
				if (ev.code == 1001 || ev.code == 1000)
				{
					log ('Корректное завершение, ');
					log ("OK\n", 'ok');
				}
				else
				{
					log ('Некорректное завершение: ', 'error');
					statuses.websock = false;
					log (ev.code +" - "+ev.reason+"\n");
				}

				audio_test();
			};
		}
		catch (e)
		{
			log ('Ошибка запуска сокета: ', 'error');
			log (ev.message+"\n");
			statuses.websock = false;
			audio_test();
		}
	}

}

function audio_fmt_result (res)
{
	switch (res)
	{
		case 'yes' : 
			log ('да', 'ok');
			break;

		case 'maybe' :
		case 'probably' :
			log ('возможно', 'warn');
			break;

		default :
			log ('нет ('+res+')', 'error');
			statuses.audio = false;
			break;
	}
}

function audio_play (index, nextEvent)
{
	if (player)
		delete player;

	player = document.createElement('audio');

	playTimer = setTimeout (function() { 
		log ("Что-то пошло не так, браузер не отвечает на запросы аудио.\n", 'error');
		statuses.audio = false;
		nextEvent();
	}, 5000); 

	player.onloadstart = function() {
		log ("Буферизируем аудиопоток...\n");

		/*loadTimer = setTimeout (function() { 
			log ("Загрузка идёт слишком долго. Вероятно, у Вас низкая скорость подключения или у браузера проблемы с буферизацией. В таких условиях радио слушать не получится.\n", 'warn');
			nextEvent();
		}, 10000); // 10s for buffering, otherwise there is no way to listen radio at such low speed*/
	}

	player.oncanplay = function() {
		clearTimeout (loadTimer);
		clearTimeout (playTimer);

		playTimer = setTimeout (function() { 
			log ("Если музыки до сих пор нет, есть какие-то проблемы с аудио.\n", 'error');
			statuses.audio = false;
			nextEvent();
		}, 25000);

		log ("Идёт воспроизведение. Вы должны слышать музыку...\n", 'info');
	}

	player.onplay = function() {
		clearTimeout(playTimer);
	}

	player.onerror = function() {
		clearTimeout (playTimer);
		clearTimeout (loadTimer);
		log ("Ошибка! Не получилось начать воспроизведение.\n", 'error');
		statuses.audio = false;
		nextEvent();
	}

	player.onpause = function() {
		clearTimeout (playTimer);
		log ("Воспроизведение завершено.\n", 'info');
		nextEvent();
	}

	player.src = audios[index].file;

	if (is_mobile())
	{
		$('#audio-play').off();
		$('#audio-play').click(function() {
			$('#audio-popup').hide();
			player.play();
		});

		$('#audio-popup').show();
	}
	else
		player.play();
}

function audio_test()
{
	log ("\nПроверяю подсистему аудио\n", 'info');

	if (!('Audio' in window))
	{
		log ("Браузер не поддерживает элементы Audio!\n", 'error');
		statuses.audio = false;
	}
		else
	{
		log ("Аудио вроде поддерживается. Проверяю форматы...\n");

		var a = document.createElement('audio');

		log ('MP3: ', 'info');
		audio_fmt_result(a.canPlayType(audios[0].type));
		log ("\n");

		log ('AAC: ', 'info');
		audio_fmt_result(a.canPlayType(audios[1].type));
		log ("\n");

		delete a;

		log ("Проверяю воспроизведение на практике\n", 'info');

		log ("\n* Формат MP3\n", 'info');
		audio_play(0, function() {
			log ("\n* Формат AAC\n", 'info');
			audio_play(1, function() {
				log ("\n* Формат HE-AAC\n", 'info');
					audio_play(2, function() {
						log ("Тестирование аудио завершено.\n");
						finish_test();
					});
			});
		}); 

	}
}

function finish_test()
{
	log ("=================================================\n");
	log ("* Результаты проверки *\n");

	log ('Серверы: '+
		((statuses.servers) ? 'OK' : 'СБОЙ') + "\n",
		(statuses.servers) ? 'ok' : 'error'
	);

	log ('Чат: '+
		((statuses.websock) ? 'OK' : 'СБОЙ') + "\n",
		(statuses.websock) ? 'ok' : 'error'
	);

	log ('Радио: '+
		((statuses.audio) ? 'OK' : 'СБОЙ') + "\n",
		(statuses.audio) ? 'ok' : 'error'
	);

	log ("=================================================\n");
	log ('Если что-то пошло не так, отправьте скриншот этой страницы (НЕ обрезая его) разработчикам радиостанции в <a href="https://vk.com/im?sel=-102590561" target="_blank">группу ВК</a> или на почту problem@provoda.ch');
}
