function createVoyager() {
    const group = new THREE.Group();

    // The Bus (Body)
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 2, 8),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 })
    );
    group.add(body);

    // The High-Gain Antenna (The "Dish")
    const dish = new THREE.Mesh(
        new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide })
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.y = 1.5;
    group.add(dish);

    // A subtle PointLight so it "glints" in the dark
    const light = new THREE.PointLight(0xffffff, 1, 100);
    group.add(light);

    group.position.set(15000, 5000, 24000000); // 160 AU
    scene.add(group);
    return group;
}
