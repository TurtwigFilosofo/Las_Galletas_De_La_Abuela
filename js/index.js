

var stats = {
    totales: 0,
    recogidos: 0,
    faltantes: 0
};

var cookieJars = []; // Array para animar los tarros activos
var statsFPS;
var pantallaCargaOculta = false;
var juegoFinalizado = false;

const rockNames = [
    "Stone_1_Low002_stones_moss_alternate_0",
    "Stone_2_Low002_stones_moss_alternate_0",
    "Stone_3_Low002_stones_moss_alternate_0",
    "Stone_4_Low002_stones_moss_alternate_0",
    "Stone_5_Low002_stones_moss_alternate_0"
];


const defaultY = [0.85, 1.25, 2.6, 3.6, 4.8];

var CONFIG = {
    walkSpeed: 10,
    maxAirSpeed: 11,
    jumpForce: 10,           // Impulso vertical
    cameraRotationSpeed: 0.05 // Velocidad de giro de la cámara
};

var renderer, scene, camera, world, player;
var plataformas = []; 
var reloj = new THREE.Clock();
var keys = { 
    w: false, a: false, s: false, d: false, space: false, p: false,
    arrowleft: false, arrowright: false, enter: false 
};

var TempMove = new THREE.Vector3();
var Forward = new THREE.Vector3();
var Right = new THREE.Vector3();
var Up = new THREE.Vector3(0, 1, 0);

var cameraAngle = 0; 
// --- CONFIGURACIÓN PANTALLA DE TÍTULO ---
var tiempoEsperaCarga = 3000; // Variable para cambiar el tiempo (en milisegundos)
var puedeQuitarCarga = false;
var pantallaCargaOculta = false;

// Al pasar el tiempo definido, permitimos que aparezca el mensaje
setTimeout(() => {
    puedeQuitarCarga = true;
    if (mensaje) mensaje.style.display = 'block';
}, tiempoEsperaCarga);

// Modificamos el evento de teclado existente o añadimos uno para detectar el Enter inicial
window.addEventListener('keydown', (e) => {
    if (e.key === "Enter" && puedeQuitarCarga && !pantallaCargaOculta) {
        quitarPantallaCarga();
    }
});

function quitarPantallaCarga() {
    const pantalla = document.getElementById('pantalla-carga');
    if (pantalla) {
        pantalla.style.opacity = '0'; // Efecto de desvanecimiento
        setTimeout(() => {
            pantalla.style.display = 'none'; // Eliminamos totalmente
            pantallaCargaOculta = true;
            keys.enter = false;
        }, 1000); // Espera a que termine la transición de CSS
    }
}
init();
createPhysicsWorld();
createLevel();
setupInputs();
crearFrontera();
loadPlayer();

nivelPiedras();
decorarEscena()

render();
// ... dentro de la función init() ...

function init() {
    renderer = new THREE.WebGLRenderer({ 
        antialias: false, 
        precision: "mediump", 
        powerPreference: "high-performance" 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x87CEEB));
    
    // --- OPTIMIZACIÓN CRÍTICA ---
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; 
    renderer.shadowMap.autoUpdate = false; // Desactivamos el cálculo en cada frame
    
    document.getElementById('container').appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    statsFPS = new Stats();
    statsFPS.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    
    // Estilo para colocarlo abajo a la derecha
    statsFPS.dom.style.position = 'absolute';
    statsFPS.dom.style.top = 'auto';
    statsFPS.dom.style.bottom = '0px';
    statsFPS.dom.style.left = 'auto';
    statsFPS.dom.style.right = '0px';
    
    document.body.appendChild(statsFPS.dom);
}

function createPhysicsWorld() {
    world = new CANNON.World();
    world.gravity.set(0, -20, 0);
    world.solver.iterations = 5;
    world.allowSleep = true;
    // Material físico global para evitar que el personaje se "pegue"
    var physicsMaterial = new CANNON.Material("physicsMaterial");
    var contactMaterial = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
        friction: 0.0,
        restitution: 0.1
    });
    world.addContactMaterial(contactMaterial);
    world.defaultContactMaterial = contactMaterial;
}

function setupInputs() {
    window.addEventListener('keydown', (e) => { 
        const key = e.key.toLowerCase();
        
        // --- CASO 1: PANTALLA DE CARGA ACTIVA ---
        if (!pantallaCargaOculta) {
            if (key === "enter" && puedeQuitarCarga) {
                quitarPantallaCarga();
                // Bloqueamos la propagación para que el juego no reciba este Enter
                e.preventDefault();
                return; 
            }
            return; 
        }

        // --- CASO 2: JUEGO EN MARCHA ---
        if (key === " ") { keys.space = true; e.preventDefault(); }
        
        // Guardamos el estado de las teclas en el objeto global
        if (keys.hasOwnProperty(key)) {
            keys[key] = true;
            // Si es enter, prevenimos comportamiento por defecto (scroll)
            if (key === "enter") e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => { 
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
    });
}
function loadPlayer() {
    var loader = new THREE.FBXLoader();
    loader.load('models/Sporty_Granny.fbx', function(object) {
        object.scale.setScalar(0.01); 
        object.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(object);

        var body = new CANNON.Body({ mass: 1, fixedRotation: true, allowSleep: false });
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.9, 0.5)));
        body.position.set(0, 5, 0); 
        world.addBody(body);

        var mixer = new THREE.AnimationMixer(object);
        var actions = {};
        
        // CORRECCIÓN: Nombres con mayúsculas según tus archivos en el servidor
        var anims = ['Idle', 'Jogging', 'Jumping', 'Falling_Idle', 'Hip_Hop_Dancing'];

        anims.forEach(id => {
            loader.load('models/' + id + '.fbx', function(animData) {
                var clip = animData.animations[0];
                clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position') || t.name.indexOf('Hips') === -1);
                var action = mixer.clipAction(clip);
                
                // CORRECCIÓN: Comparación sensible a mayúsculas
                if (id === 'Jogging') action.timeScale = 1.5;
                if (id === 'Jumping') { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
                
                // Guardamos en el objeto actions usando minúsculas para facilitar el acceso en el update
                actions[id.toLowerCase()] = action;
                
                if (id === 'Idle') action.play();
            }, undefined, function(err) {
                console.error("Error cargando animación " + id + ":", err);
            });
        });

        player = { mesh: object, body: body, mixer: mixer, actions: actions, currentActionId: 'idle', aabb: new THREE.Box3() };
    }, undefined, function(err) {
        console.error("Error cargando modelo principal Granny:", err);
    });
}

function createLevel() {
    var loader = new THREE.TextureLoader();
    var grassTexture = loader.load('textures/grass.jpg');
    
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping; 
    grassTexture.repeat.set(10, 10);
    if (renderer) grassTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    scene.add(new THREE.AmbientLight(0xffffff, 0.3)); 

    var sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 80, 50); 
    sun.castShadow = true;
    var sRange = 35; 
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 190;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -sRange;
    sun.shadow.camera.right = sun.shadow.camera.top = sRange;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;

    renderer.shadowMap.autoUpdate = false; // Solo se actualiza bajo demanda
    renderer.shadowMap.needsUpdate = true; // Primera actualización para el nivel estático
    sun.shadow.autoUpdate = true;
    
    sun.shadow.radius = 1; 
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    var gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load('models/cabine.glb', function(gltf) {
        var cabina = gltf.scene;
        
        var cPosX = 0;
        var cPosY = 1;
        var cPosZ = -5; 
        
        cabina.position.set(cPosX, cPosY, cPosZ);
        cabina.scale.set(1, 1, 1); 
        
        cabina.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        cabina.matrixAutoUpdate = false; 
        cabina.updateMatrix();

        cabina.traverse(node => {
            if (node.isMesh) {
                node.frustumCulled = false; // Desactiva la comprobación de "está en cámara"
            }
        });

        scene.add(cabina);
        // --- FÍSICA COMPUESTA (CANNON.JS) ---
        var cabineBody = new CANNON.Body({ mass: 0 });
        cabineBody.allowSleep = true;
        cabineBody.sleep();
        cabineBody.position.set(cPosX, cPosY, cPosZ);

        // 1. BASE (Ajustes manuales)
        var hBase = new CANNON.Vec3(2.35, 0.5, 2.275);
        var oBase = new CANNON.Vec3(-0.3, -0.4, -0.25);
        cabineBody.addShape(new CANNON.Box(hBase), oBase);

        // 2. CASA (Ajustes manuales)
        var hCasa = new CANNON.Vec3(1.15, 1.5, 1.25);
        var oCasa = new CANNON.Vec3(-0.35, 2, -0.3);
        cabineBody.addShape(new CANNON.Box(hCasa), oCasa);

        world.addBody(cabineBody);

        // --- REGISTRO DE SUELO PARA EL SALTO (AABB) ---
        var baseAABB = new THREE.Box3();
        baseAABB.setFromCenterAndSize(
            new THREE.Vector3(cPosX + oBase.x, cPosY + oBase.y, cPosZ + oBase.z),
            new THREE.Vector3(hBase.x * 2, hBase.y * 2, hBase.z * 2)
        );
        plataformas.push(baseAABB);

        var casaAABB = new THREE.Box3();
        casaAABB.setFromCenterAndSize(
            new THREE.Vector3(cPosX + oCasa.x, cPosY + oCasa.y, cPosZ + oCasa.z),
            new THREE.Vector3(hCasa.x * 2, hCasa.y * 2, hCasa.z * 2)
        );
        plataformas.push(casaAABB);

    }, undefined, function(error) {
        console.error("Error cargando cabine.glb:", error);
    });

    crearPlataforma(0, -0.5, 0, 50, 1, 50, grassTexture);
    setTimeout(() => {
        renderer.shadowMap.needsUpdate = true; 
        console.log("Sombras estáticas calculadas.");
    }, 1000);
}


function crearPlataforma(x, y, z, dx, dy, dz, textura = null) {
    // Para oscurecer la textura, usamos un gris oscuro en lugar de blanco.
    // Cuanto más cerca del negro (0x000000), más oscura será la hierba.
    var tonoOscuro = 0x555555; 

    var materialConfig = {};
    if (textura) {
        materialConfig.map = textura;
        materialConfig.color = new THREE.Color(tonoOscuro); // Esto oscurece la textura
    } else {
        materialConfig.color = new THREE.Color(0x333333); // Color por defecto si no hay imagen
    }

    var mesh = new THREE.Mesh(
        new THREE.BoxGeometry(dx, dy, dz),
        new THREE.MeshPhongMaterial(materialConfig)
    );

    mesh.traverse(node => {
        if (node.isMesh) {
            node.frustumCulled = false; // Desactiva la comprobación de "está en cámara"
        }
    });
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);

    // El resto de la función (AABB y Cannon.js) se mantiene igual...
    var box = new THREE.Box3().setFromObject(mesh);
    plataformas.push(box);

    var body = new CANNON.Body({ mass: 0 });
    body.allowSleep = true;
    body.sleep();
    body.addShape(new CANNON.Box(new CANNON.Vec3(dx/2, dy/2, dz/2)));
    body.position.set(x, y, z);
    world.addBody(body);
}

function checkGroundedAABB() {
    if (!player) return false;
    var pPos = player.body.position;
    // Caja de detección situada en los pies
    player.aabb.setFromCenterAndSize(
        new THREE.Vector3(pPos.x, pPos.y - 0.85, pPos.z), 
        new THREE.Vector3(0.01, 0.2, 0.01) 
    );
    for (var i = 0; i < plataformas.length; i++) {
        if (player.aabb.intersectsBox(plataformas[i])) return true;
    }
    return false;
}

// IMPORTANTE: Declara esta variable fuera de la función update, al inicio de tu test.js
var frameCount = 0; 
var vImpulse = new CANNON.Vec3(); // Reutilizamos para el salto

function update() {
    if (juegoFinalizado) return;
    if (!player || !player.mesh) {
        renderer.render(scene, camera);
        return; 
    }
    var deltaTime = reloj.getDelta();
    world.step(1/60, deltaTime, 3);
    
    frameCount++;

    if (player && player.mixer) {
        // 1. CONTROL DE CÁMARA
        if (keys.arrowleft) cameraAngle -= CONFIG.cameraRotationSpeed;
        if (keys.arrowright) cameraAngle += CONFIG.cameraRotationSpeed;
        if (keys.enter && pantallaCargaOculta) {
            cameraAngle = player.mesh.rotation.y + Math.PI;
            keys.enter = false; 
        }

        // 2. SUELO (AABB)
        var isGrounded = checkGroundedAABB();

        // 3. MOVIMIENTO RELATIVO A CÁMARA
        Forward.set(0, 0, -1).applyAxisAngle(Up, cameraAngle);
        Right.crossVectors(Up, Forward).negate();

        TempMove.set(0, 0, 0);
        if (keys.w) TempMove.add(Forward);
        if (keys.s) TempMove.sub(Forward);
        if (keys.a) TempMove.sub(Right);
        if (keys.d) TempMove.add(Right);

        var speed = isGrounded ? CONFIG.walkSpeed : CONFIG.maxAirSpeed;

        // OPTIMIZACIÓN: Usar lengthSq() es más rápido que length() (evita Math.sqrt)
        if (TempMove.lengthSq() > 0) {
            TempMove.normalize();
            player.body.velocity.x = TempMove.x * speed;
            player.body.velocity.z = TempMove.z * speed;
            player.mesh.rotation.y = Math.atan2(TempMove.x, TempMove.z);
        } else {
            player.body.velocity.x *= 0.2; 
            player.body.velocity.z *= 0.2;
        }

        // --- SALTO POR IMPULSO ---
        if (keys.space && isGrounded) {
            player.body.wakeUp();
            player.body.velocity.y = 0; 

            vImpulse.set(0, CONFIG.jumpForce, 0); // Reutilizamos vector global
            player.body.applyImpulse(vImpulse, player.body.position);
            
            isGrounded = false;
            keys.space = false;
        } else if(keys.space) {keys.space = false;}

        // --- OPTIMIZACIÓN 2: SHADOW DEBAYERING (GPU AL 50%) ---
        // Solo actualizamos el mapa de sombras en frames pares.
        // Las sombras irán a 30fps y el juego a 60fps, ahorrando muchísimo proceso.
        if (TempMove.lengthSq() > 0 || !isGrounded || Math.abs(player.body.velocity.y) > 0.1) {
            if (frameCount % 2 === 0) {
                renderer.shadowMap.needsUpdate = true;
            }
        }

        // 4. ANIMACIONES
        // Dentro de la función update()
        var nextId = 'idle';

        if (!isGrounded) {
            nextId = (player.body.velocity.y > 0.5) ? 'jumping' : 'falling_idle';
        } else if (TempMove.lengthSq() > 0.01) { // Añadimos un pequeño margen
            nextId = 'jogging'; // DEBE ser minúscula si usaste id.toLowerCase() al cargar
        } else if (keys.p) {
            nextId = 'hip_hop_dancing';
        }

        // Cambiar la animación si es necesario
        if (player.currentActionId !== nextId && player.actions[nextId]) {
            player.actions[player.currentActionId].fadeOut(0.2);
            player.actions[nextId].reset().fadeIn(0.2).play();
            player.currentActionId = nextId;
        }

        // --- SINCRONIZACIÓN Y MIXER ---
        player.mesh.position.copy(player.body.position);
        player.mesh.position.y -= 0.9; 
        
        // Usamos el delta real para que la animación no de tirones
        if (deltaTime > 0) {
        player.mixer.update(deltaTime); 
    }

        // 5. CÁMARA ORBITAL
        var dist = 12, altura = 6;
        camera.position.x = player.mesh.position.x + Math.sin(cameraAngle) * dist;
        camera.position.z = player.mesh.position.z + Math.cos(cameraAngle) * dist;
        camera.position.y = player.mesh.position.y + altura;
        camera.lookAt(player.mesh.position.x, player.mesh.position.y + 2, player.mesh.position.z);
    }
    
    cookieJars.forEach((jar, index) => {
    jar.rotation.y += 0.05;

    if (!jar.userData.isCollected) {
        // OPTIMIZACIÓN: distanceToSquared evita Math.sqrt()
        // 1.5 de radio -> 1.5 * 1.5 = 2.25
        let distSq = jar.position.distanceToSquared(player.mesh.position);
        
        if (distSq < 2.25) { 
            jar.userData.isCollected = true;
            stats.recogidos++;
            stats.faltantes = stats.totales - stats.recogidos;
            actualizarUI();
        }
    } else {
        // 3. Animación de "Desaparecer": Subir y salir volando
        jar.userData.velocityUp += 0.5; // Aceleración hacia arriba
        jar.position.y += jar.userData.velocityUp;
        jar.scale.multiplyScalar(0.9); // Se encoge mientras sube

        // Eliminar de la escena cuando esté muy alto o pequeño
        if (jar.position.y > 50 || jar.scale.x < 0.01) {
            scene.remove(jar);
            cookieJars.splice(index, 1);
        }
    }
    });
    if (stats.recogidos > 0 && stats.recogidos === stats.totales && cookieJars.length === 0 && !juegoFinalizado) {
        finalizarJuego();
    }
}

function render() {
    statsFPS.begin();
    requestAnimationFrame(render);
    update();
    renderer.render(scene, camera);
    statsFPS.end();
}

function actualizarUI() {
    document.getElementById('t').innerText = stats.totales;
    document.getElementById('r').innerText = stats.recogidos;
    document.getElementById('f').innerText = stats.faltantes;
}

function createTree(x,y,z,n) {
    var num = n % 3;
    var gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load('models/tree1.glb', function(gltf) {
            var tree1 = gltf.scene;
            
            var cPosX = x;
            var cPosY = y;
            var cPosZ = z; 
            
            tree1.position.set(cPosX, cPosY, cPosZ);
            tree1.scale.set(1, 1, 1); 
            
            tree1.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            tree1.matrixAutoUpdate = false;
            tree1.updateMatrix();
            scene.add(tree1);
        });
}


function cargarModeloPorNombre(path, x, y, z, nombrePieza = "", scale = 1, conFisica = false, tipoColision = "auto") {
    var gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(path, function(gltf) {
        var group = gltf.scene;
        group.scale.setScalar(scale);
        scene.add(group);

        let piezaActiva = group;

        // 1. Filtrado de mallas (Si es parte de un set como stones2.glb)
        if (nombrePieza !== "") {
            group.traverse(child => {
                if (child.isMesh) {
                    if (child.name === nombrePieza) {
                        child.visible = true;
                        piezaActiva = child;
                    } else {
                        child.visible = false;
                    }
                }
            });
            
            group.updateMatrixWorld(true);
            var worldPos = new THREE.Vector3();
            piezaActiva.getWorldPosition(worldPos);
            group.position.set(x - worldPos.x, y, z - worldPos.z);
        } else {
            group.position.set(x, y, z);
        }

        // --- OPTIMIZACIÓN: DORMIR LA ESCENA ESTÁTICA ---
        // Primero actualizamos la matriz una última vez para que el objeto esté en su sitio
        group.updateMatrixWorld(true);

        // Desactivamos la actualización automática para el grupo y todas sus mallas hijas
        group.matrixAutoUpdate = false; 

        group.traverse(node => { 
            if (node.isMesh) { 
                node.castShadow = true; 
                node.receiveShadow = true; 
                
                // Esto es vital: le decimos a Three.js que NO recalcule la posición de la malla cada frame
                node.matrixAutoUpdate = false; 
                node.updateMatrix(); // Fijamos la posición actual como definitiva

                // Opcional: Ayuda al motor a descartar el objeto si no está frente a la cámara
                node.frustumCulled = true; 
            } 
        });
        // ----------------------------------------------

        // 2. FÍSICA (CANNON.JS)
        if (conFisica) {
            let shape, bodyPos, boxForAABB;
            if (tipoColision === 'trunk') {
                var halfH = 5; 
                shape = new CANNON.Box(new CANNON.Vec3(0.25, halfH, 0.25));
                bodyPos = new CANNON.Vec3(x, y + halfH, z);
                boxForAABB = new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(x, y + halfH, z),
                    new THREE.Vector3(0.5, halfH * 2, 0.5)
                );
            } else {
                var box = new THREE.Box3().setFromObject(piezaActiva);
                var size = new THREE.Vector3();
                box.getSize(size);
                var center = new THREE.Vector3();
                box.getCenter(center);

                shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
                bodyPos = new CANNON.Vec3(center.x, center.y, center.z);
                boxForAABB = box;
            }

            var body = new CANNON.Body({ mass: 0 }); // Masa 0 = Estático (no se mueve)
            body.addShape(shape);
            body.position.copy(bodyPos);
            
            // OPTIMIZACIÓN FÍSICA: Ponemos el cuerpo a "dormir" inmediatamente
            body.allowSleep = true;
            body.sleep(); 
            
            world.addBody(body);
            plataformas.push(boxForAABB);
        }
    });
}

// Árboles
function addTree(x, y, z, n = 1, solid = true) {
    let s = 1;
    // Aplicamos las escalas específicas por tipo
    if (n === 1) s = 0.07;
    else if (n === 2) s = 0.5;
    else if (n === 3) s = 0.8;

    // Pasamos un nuevo parámetro 'trunk' para indicar el tipo de colisión
    cargarModeloPorNombre('models/tree' + n + '.glb', x, y, z, "", s, solid, 'trunk');
}


function addRock(x, yOffset, z, typeIndex = 0, conFisica = true, scale = 0.07) {
    let path, nombrePieza, finalY;

    if (typeIndex <= 0 || typeIndex > 5) {
        path = 'models/rock.glb';
        nombrePieza = ""; 
        finalY = yOffset; // rock.glb suele estar bien centrado
        if (scale === 0.07) scale = 1.0; 
    } else {
        path = 'models/stones2.glb';
        nombrePieza = rockNames[typeIndex - 1];
        
        // Aquí aplicas tu corrección manual guardada en defaultY
        // finalY = (El valor que ajusta la piedra al suelo) + el extra que quieras subirla
        finalY = (defaultY[typeIndex - 1] * scale) + yOffset;
    }

    cargarModeloPorNombre(path, x, finalY, z, nombrePieza, scale, conFisica);
}



function addCookieJar(x, y, z, scale = 1) {
    var gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load('models/cookies_jar.glb', function(gltf) {
        var jar = gltf.scene;
        jar.position.set(x, y, z);
        jar.scale.setScalar(scale);
        
        // --- EFECTO DE BRILLO Y CONFIGURACIÓN ---
        jar.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.frustumCulled = false;
                // Brillo sutil (Emisivo)
                node.material.emissive = new THREE.Color(0xffff00);
                node.material.emissiveIntensity = 0.2;
            }
        });

        // Inclinación inicial estética
        jar.rotation.x = 0.2;
        jar.rotation.z = 0.2;

        // Propiedades personalizadas para la lógica
        jar.userData = {
            isCollected: false,
            velocityUp: 0
        };

        scene.add(jar);
        cookieJars.push(jar);
        
        // Actualizamos contadores
        stats.totales++;
        stats.faltantes = stats.totales - stats.recogidos;
        actualizarUI(); // Función opcional para mostrar datos en pantalla
    });
}

// Sustituye tu función crearFrontera por esta versión ultra-eficiente
function crearFrontera() {
    var espaciado = 5, tamañoPlataforma = 50, offsetExterior = 1.9;
    
    // Ajuste de altura para que queden perfectas en el borde
    var alturaPiedras = -0.5; 
    var limitePiedras = (tamañoPlataforma / 2) + offsetExterior;
    var limiteMuro = tamañoPlataforma / 2;

    var loader = new THREE.GLTFLoader();
    loader.load('models/stones2.glb', function(gltf) {
        var originalMesh = null;
        gltf.scene.traverse(child => {
            if (child.name === rockNames[3]) originalMesh = child; 
        });

        if (!originalMesh) return;

        var posPiedras = [];
        for (let i = -limitePiedras; i <= limitePiedras; i += espaciado) {
            posPiedras.push(new THREE.Vector3(i, alturaPiedras, limitePiedras));
            posPiedras.push(new THREE.Vector3(i, alturaPiedras, -limitePiedras));
            if (i > -limitePiedras && i < limitePiedras) {
                posPiedras.push(new THREE.Vector3(limitePiedras, alturaPiedras, i));
                posPiedras.push(new THREE.Vector3(-limitePiedras, alturaPiedras, i));
            }
        }

        var instancedRock = new THREE.InstancedMesh(originalMesh.geometry, originalMesh.material, posPiedras.length);
        
        // --- CAMBIO PARA QUITAR SOMBRAS ---
        instancedRock.castShadow = false;    // No proyecta sombra
        instancedRock.receiveShadow = false; // No recibe sombras de otros objetos
        // ----------------------------------

        instancedRock.matrixAutoUpdate = false; 

        var dummy = new THREE.Object3D();
        posPiedras.forEach((pos, i) => {
            dummy.position.copy(pos);
            
            // Corrección de rotación para que estén verticales
            dummy.rotation.x = -Math.PI / 2; 
            dummy.rotation.z = Math.random() * Math.PI; 

            dummy.scale.setScalar(0.07);
            dummy.updateMatrix();
            instancedRock.setMatrixAt(i, dummy.matrix);
        });

        scene.add(instancedRock);
    });

    // Los muros físicos se quedan igual para que no te caigas del mapa
    const crearMuroFisico = (x, y, z, dx, dy, dz) => {
        var shape = new CANNON.Box(new CANNON.Vec3(dx / 2, dy / 2, dz / 2));
        var body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(x, y, z);
        world.addBody(body);
    };

    var halfH = 50, yMuroPos = 50, largoMuro = tamañoPlataforma;
    crearMuroFisico(0, yMuroPos, limiteMuro, largoMuro, 100, 2);
    crearMuroFisico(0, yMuroPos, -limiteMuro, largoMuro, 100, 2);
    crearMuroFisico(limiteMuro, yMuroPos, 0, 2, 100, largoMuro);
    crearMuroFisico(-limiteMuro, yMuroPos, 0, 2, 100, largoMuro);
}

function nivelPiedras(){
    addRock(15,0,15, 1)
    addRock(15,0,10, 2)
    addRock(10,-0.35,10, 4)
    addCookieJar(10,9,10, 4)
    addRock(10,0,15, 2)
    addRock(10,2,15, 0)
    addRock(5,0.1,10, 2)
    addRock(5,2.85,10, 2)
    addRock(15,0,-3, 2)
    addRock(5,0,-3, 2)
    addRock(15,0,-15, 2)
    addCookieJar(15,4,-15, 4)
    addCookieJar(-1.5,6,-6.5, 4)
    addRock(-5,0.1,-3, 2)
    addRock(-5,2.85,-3, 2)
    addRock(-12,-0.4,-6, 4)
    addRock(-22,-0.4,-23, 5)
    addRock(-16,-0.4,-16, 4)
    addRock(-14,0,-19, 4)
    addRock(-18,1.5,-20, 4)
    addRock(-12,-0.4,-22, 4)
    addCookieJar(-18,0,-20, 4)
    addCookieJar(-22,13,-23, 4)
    addCookieJar(-22,0.25,23, 4)
}

function decorarEscena() {
    // --- CONCENTRACIÓN ESQUINA SUPERIOR IZQUIERDA (X-, Z+) ---
    // Agrupamos 4 de los 7 árboles y 1 piedra aquí
    addTree(-14, 0, 14, 1, true); // Árbol tipo 1
    addTree(-16, 0, 20, 3, true); // Árbol tipo 3
    addTree(-22, 0, 12, 2, true); // Árbol tipo 2
    addTree(-10, 0, 10, 1, true); // Árbol tipo 1
    addRock(-18, 0, 16, 0, true, 1.0); // Piedra tipo 0

    // --- RESTO DE ELEMENTOS DISTRIBUIDOS (Lejos del centro) ---
    
    // Árboles restantes (3)
    addTree(20, 0, 15, 2, true);  // Lateral derecho fondo
    addTree(15, 0, -18, 3, true); // Lateral derecho frente
    addTree(22, 0, 0, 1, true);   // Lateral derecho medio

    // Piedras tipo 0 restantes (4)
    addRock(18, 0, 20, 0, true, 1.0);  // Esquina superior derecha
    addRock(20, 0, -10, 0, true, 1.0); // Lateral derecho frente
    addRock(0, 0, 23, 0, true, 1.0);   // Fondo central (fuera de radio 5)
    addRock(-5, 0, -20, 0, true, 1.0); // Frente izquierda (fuera de radio 5)
}

function finalizarJuego() {
    juegoFinalizado = true; // Bloquea el update
    pantallaCargaOculta = false; // Bloquea los inputs de teclado

    const pantallaFinal = document.getElementById('pantalla-final');
    
    // 1. Hacemos visible el contenedor (pero sigue con opacity 0)
    pantallaFinal.style.display = 'flex';
    
    // 2. Pequeño delay para que el navegador procese el display:flex y la transición funcione
    setTimeout(() => {
        pantallaFinal.style.opacity = '1';
    }, 50);

    // 3. Opcional: Detener música o sonidos si los tuvieras
    console.log("¡Juego terminado! Todas las galletas recogidas.");
}
