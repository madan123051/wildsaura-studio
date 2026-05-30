"""
WildSaura Studio — AI Auto-Crop Model
MobileNetV2-based model that predicts optimal crop center and scale
given an image and a desired aspect ratio.

Outputs: (center_x, center_y, scale) — all normalized 0–1
  - center_x / center_y : normalized crop-box center
  - scale               : fraction of min(img_width, img_height) used as crop width
                          (crop height is derived automatically from aspect ratio)
"""

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model


# ──────────────────────────────────────────────
# Model Definition
# ──────────────────────────────────────────────

def create_auto_crop_model(input_shape=(224, 224, 3)):
    """
    Build the auto-crop model.

    Args:
        input_shape: HWC tuple for image input (default 224×224×3).

    Returns:
        A compiled Keras Model with inputs [image, aspect_ratio]
        and output crop_params (center_x, center_y, scale).

    Alpha / size trade-off for MobileNetV2:
        alpha=0.35  →  ~2.5 MB .tflite  (lower accuracy)
        alpha=0.50  →  ~4.5 MB .tflite  (moderate)
        alpha=0.75  →  ~9 MB   .tflite  (good)
        alpha=1.00  →  ~12 MB  .tflite  (best accuracy)
    """
    # ── Inputs ──────────────────────────────────
    img_input   = layers.Input(shape=input_shape, name='image')
    ratio_input = layers.Input(shape=(1,),         name='aspect_ratio')

    # ── Backbone (MobileNetV2, frozen initially) ─
    backbone = tf.keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet',
        alpha=1.0,      # change to 0.35 / 0.50 / 0.75 for lighter models
    )
    backbone.trainable = False

    x = backbone(img_input)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.3)(x)

    # ── Aspect-ratio branch ──────────────────────
    y = layers.Dense(16, activation='relu')(ratio_input)
    y = layers.Dense(32, activation='relu')(y)

    # ── Fusion ──────────────────────────────────
    combined = layers.Concatenate()([x, y])
    combined = layers.Dense(128, activation='relu')(combined)
    combined = layers.Dropout(0.2)(combined)

    # ── Output: (center_x, center_y, scale) ─────
    output = layers.Dense(3, activation='sigmoid', name='crop_params')(combined)

    model = Model(inputs=[img_input, ratio_input], outputs=output)
    return model


# ──────────────────────────────────────────────
# Model Instantiation & Compilation
# ──────────────────────────────────────────────

model = create_auto_crop_model()
model.summary()

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
    loss='mse',     # swap for a custom IoU loss if preferred
    metrics=['mae'],
)


# ──────────────────────────────────────────────
# Crop-box Calculation (reference)
# ──────────────────────────────────────────────
#
# Given model outputs (cx, cy, scale) and target ratio r = width/height:
#
#   crop_w = scale * min(img_width, img_height)
#   crop_h = crop_w / r
#
#   x1 = int((cx * img_width)  - crop_w / 2)
#   y1 = int((cy * img_height) - crop_h / 2)
#   x2 = int(x1 + crop_w)
#   y2 = int(y1 + crop_h)


# ──────────────────────────────────────────────
# Training (example — uncomment and adapt)
# ──────────────────────────────────────────────
#
# train_ds = tf.data.Dataset.from_tensor_slices(
#     ((train_images, train_ratios), train_labels)
# )
# train_ds = train_ds.map(
#     lambda inputs, lbl: (
#         (tf.image.resize(inputs[0], (224, 224)) / 255.0, inputs[1]),
#         lbl,
#     )
# ).batch(32).prefetch(tf.data.AUTOTUNE)
#
# model.fit(train_ds, epochs=50, validation_data=val_ds)


# ──────────────────────────────────────────────
# Inference
# ──────────────────────────────────────────────

def predict_crop(model, image_path: str, aspect_ratio: float = 1.0):
    """
    Predict the optimal crop box for an image.

    Args:
        model:        Trained Keras model.
        image_path:   Path to the source image.
        aspect_ratio: width / height  (e.g. 1.0=square, 4/3≈1.333, 16/9≈1.778).

    Returns:
        crop_img: Cropped numpy array (BGR).
        bbox:     (x1, y1, x2, y2) pixel coordinates (clipped to image bounds).
    """
    img = cv2.imread(image_path)
    h, w = img.shape[:2]

    # Preprocess
    img_resized = cv2.resize(img, (224, 224)) / 255.0
    ratio = np.array([[aspect_ratio]], dtype=np.float32)

    cx, cy, scale = model.predict(
        [np.expand_dims(img_resized, axis=0), ratio]
    )[0]

    # Compute crop size respecting the target aspect ratio
    min_dim = min(w, h)
    crop_w  = scale * min_dim
    crop_h  = crop_w / aspect_ratio

    # Map center to pixel coordinates
    center_x = cx * w
    center_y  = cy * h

    x1 = int(center_x - crop_w / 2)
    y1 = int(center_y - crop_h / 2)
    x2 = int(center_x + crop_w / 2)
    y2 = int(center_y + crop_h / 2)

    # Clip to image boundaries
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)

    crop_img = img[y1:y2, x1:x2]
    return crop_img, (x1, y1, x2, y2)


# ──────────────────────────────────────────────
# Export to TFLite
# ──────────────────────────────────────────────

def export_tflite(model, output_path: str = 'smart_crop.tflite'):
    """
    Convert and save the Keras model as a TFLite flatbuffer.

    Args:
        model:       Trained Keras model.
        output_path: Destination file path for the .tflite model.
    """
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    tflite_model = converter.convert()

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"TFLite model saved to: {output_path}")


# Uncomment to export after training:
# export_tflite(model, 'smart_crop.tflite')
