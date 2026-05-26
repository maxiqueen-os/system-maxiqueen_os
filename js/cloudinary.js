async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "maxiqueen_upload");

    const res = await fetch(
        "https://api.cloudinary.com/v1_1/maxiqueen-os/image/upload",
        {
            method: "POST",
            body: formData
        }
    );

    const data = await res.json();

    return data.secure_url;
}

window.uploadToCloudinary = uploadToCloudinary;
