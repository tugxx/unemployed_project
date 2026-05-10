use std::sync::OnceLock;
use tract_onnx::prelude::*;

#[allow(dead_code)]
type RunnableModel = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

#[allow(dead_code)]
static AI_MODEL: OnceLock<RunnableModel> = OnceLock::new();

#[allow(dead_code)]
pub fn get_ai_model() -> Option<&'static RunnableModel> {
    None
    
    /* SAU NÀY CÓ FILE THÌ MỞ ĐOẠN NÀY RA
    Some(AI_MODEL.get_or_init(|| {
        println!("🧠 Đang khởi động mạng Neural Network...");
        let model_bytes = include_bytes!("mnist_model.onnx"); 
        let mut cursor = std::io::Cursor::new(model_bytes);
        let model = tract_onnx::onnx()
            .model_for_read(&mut cursor).unwrap()
            .with_input_fact(0, f32::fact(&[1, 1, 28, 28]).into()).unwrap()
            .into_optimized().unwrap()
            .into_runnable().unwrap();
        println!("✅ Đã nạp xong AI Model!");
        model
    }))
    */
}